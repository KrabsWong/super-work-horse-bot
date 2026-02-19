import { Cron } from 'croner';
import type { BotInstance } from '../types';
import { config } from '../config';
import { executeInTmux } from '../tmux/session';

interface TodayInHistoryEvent {
  year: string;
  title: string;
}

/**
 * Fetch today's events from history API
 */
async function fetchTodayInHistory(): Promise<TodayInHistoryEvent[]> {
  try {
    const response = await fetch(`https://jkapi.com/api/history`);
    if (!response.ok) {
      throw new Error(`API request failed: ${response.status}`);
    }

    const text = await response.text();

    const events: TodayInHistoryEvent[] = [];
    const lines = text.split('\n').filter(line => line.trim());

    for (const line of lines) {
      const match = line.match(/(\d{3,4})\s+(.+)/);
      if (match) {
        events.push({
          year: match[1],
          title: match[2].trim(),
        });
      }
    }

    return events.filter(e => e.title.length > 3).slice(0, 5);
  } catch (error) {
    console.error('Failed to fetch today in history:', error);
    return [];
  }
}

/**
 * Select a positive event from the list
 */
function selectPositiveEvent(events: TodayInHistoryEvent[]): TodayInHistoryEvent | null {
  const positiveKeywords = ['出生', '成立', '发明', '发现', '成功', '诞生', '建立', '创立', '获奖', '胜利', '突破', '首次', '第一'];
  const negativeKeywords = ['逝世', '去世', '死亡', '灾难', '战争', '失败', '爆炸', '破坏', '屠杀', '起义', '革命', '战役', '希特勒', '纳粹'];

  const scoredEvents = events.map(event => {
    let score = 0;
    for (const keyword of positiveKeywords) {
      if (event.title.includes(keyword)) score += 2;
    }
    for (const keyword of negativeKeywords) {
      if (event.title.includes(keyword)) score -= 3;
    }
    return { event, score };
  });

  scoredEvents.sort((a, b) => b.score - a.score);

  const bestPositive = scoredEvents.find(e => e.score > 0);
  return bestPositive ? bestPositive.event : scoredEvents.length > 0 ? scoredEvents[0].event : null;
}

/**
 * Generate the research prompt for the cron task
 */
async function generateResearchPrompt(): Promise<string> {
  const today = new Date();
  const dateStr = `${today.getMonth() + 1}月${today.getDate()}日`;

  const events = await fetchTodayInHistory();

  let selectedEvent: TodayInHistoryEvent | null = null;

  if (events.length > 0) {
    selectedEvent = selectPositiveEvent(events);
  }

  let promptContent: string;

  if (selectedEvent) {
    promptContent = `今天是${dateStr}，历史上的${selectedEvent.year}年的今天发生了：${selectedEvent.title}。请对这个历史事件进行深入研究，分析其背景、影响和启示。`;
  } else {
    promptContent = `今天是${dateStr}，请搜索互联网上的热门话题或新闻，选择其中一个有意思的事件或话题进行深入研究分析。`;
  }

  return `硅基写手 ${promptContent}`;
}

/**
 * Build opencode command for cron execution
 */
function buildCronCommand(commandName: string, prompt: string, dir: string): string {
  const cmdConfig = config.commands[commandName];
  if (!cmdConfig) {
    throw new Error(`Command '${commandName}' is not configured`);
  }

  let opencodeCmd = 'opencode';

  if (cmdConfig.model) {
    opencodeCmd += ` --model="${cmdConfig.model}"`;
  }

  const additionalInstructions = `
IMPORTANT INSTRUCTIONS:
1. This is a RESEARCH task.
2. **STEP 1**: Read 'openspec/project.md'.
3. **STEP 2 (Routing)**: Based on my request, CHOOSE the most appropriate template from the Template Selection Strategy section.
   - If I asked for features/pricing -> Use 'product-requirement-standard.md'
   - If I asked for feasibility/integration -> 'Use tech-feasibility-standard.md'
4. **Action**: Create the directory and generated files strictly following the chosen template's structure.
5. **Language**: Report content in CHINESE (中文).
6. **Output**: Start by stating: 'Identifying Intent... Selected Template: [Template Name]'.
`;

  opencodeCmd += ` --prompt="${cmdConfig.prompt} ${prompt}${additionalInstructions}"`;

  return `cd ${dir} && ${opencodeCmd}`;
}

/**
 * Execute a cron task
 */
async function executeCronTask(
  taskName: string,
  commandName: string,
  dir: string,
  sessionName: string,
  bot: BotInstance,
  chatId: number
): Promise<void> {
  const timestamp = new Date().toISOString();

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`[${timestamp}] Cron task '${taskName}' triggered`);
  console.log(`[DEBUG] Using chatId: ${chatId} (type: ${typeof chatId})`);

  try {
    await bot.telegram.sendMessage(
      chatId,
      `⏰ 定时任务触发\n\n任务: ${taskName}\n时间: ${new Date().toLocaleString('zh-CN')}\n\n正在生成研究主题...`
    );

    const prompt = await generateResearchPrompt();
    console.log(`Generated prompt: ${prompt}`);

    const command = buildCronCommand(commandName, prompt, dir);
    console.log(`Built command: ${command}`);

    const success = await executeInTmux(command, sessionName);

    if (success) {
      console.log(`Cron task '${taskName}' executed successfully in session '${sessionName}'`);
      await bot.telegram.sendMessage(
        chatId,
        `✅ 定时任务已开始执行\n\n主题: ${prompt.substring(0, 100)}...\nSession: ${sessionName}\n\n可通过以下命令查看进度:\ntmux attach -t ${sessionName}`
      );
    } else {
      console.error(`Cron task '${taskName}' failed to execute`);
      await bot.telegram.sendMessage(
        chatId,
        `❌ 定时任务执行失败\n\n任务: ${taskName}\n请检查服务器日志获取详细信息。`
      );
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`Cron task '${taskName}' error:`, errorMessage);
    console.error(`[DEBUG] Failed to send message to chatId: ${chatId}`);
    try {
      await bot.telegram.sendMessage(
        chatId,
        `❌ 定时任务异常\n\n任务: ${taskName}\n错误: ${errorMessage}`
      );
    } catch (notifyError) {
      console.error(`[DEBUG] Failed to send error notification:`, notifyError);
    }
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}

/**
 * Initialize all cron tasks from configuration
 */
export function initializeCronTasks(bot: BotInstance): Cron[] {
  const scheduledJobs: Cron[] = [];
  const taskNames = Object.keys(config.cronTasks);

  if (taskNames.length === 0) {
    console.log('No cron tasks configured');
    return scheduledJobs;
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Initializing cron tasks...');

  for (const taskName of taskNames) {
    const taskConfig = config.cronTasks[taskName];

    if (!taskConfig.enabled) {
      console.log(`Cron task '${taskName}' is disabled, skipping`);
      continue;
    }

    try {
      const job = new Cron(
        taskConfig.schedule,
        async () => {
          await executeCronTask(
            taskName,
            taskConfig.commandName,
            taskConfig.dir,
            taskConfig.session,
            bot,
            taskConfig.chatId
          );
        },
        {
          timezone: 'Asia/Shanghai',
          name: taskName,
        }
      );

      scheduledJobs.push(job);

      const nextRun = job.nextRun();
      console.log(`Scheduled cron task '${taskName}':`);
      console.log(`  Schedule: ${taskConfig.schedule}`);
      console.log(`  Command: ${taskConfig.commandName}`);
      console.log(`  Session: ${taskConfig.session}`);
      console.log(`  Chat ID: ${taskConfig.chatId}`);
      console.log(`  Next run: ${nextRun ? nextRun.toLocaleString('zh-CN') : 'N/A'}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`Failed to schedule cron task '${taskName}': ${errorMessage}`);
    }
  }

  console.log(`Initialized ${scheduledJobs.length} cron task(s)`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  return scheduledJobs;
}

/**
 * Stop all scheduled cron jobs
 */
export function stopCronJobs(jobs: Cron[]): void {
  console.log('Stopping cron jobs...');
  for (const job of jobs) {
    job.stop();
    console.log(`Stopped cron job: ${job.name || 'unnamed'}`);
  }
  console.log('All cron jobs stopped');
}
