import { Cron } from 'croner';
import type { MessengerClient } from '../../interface/messenger/types';
import { config } from '../../config';
import { startMonitoring } from '../../infra/monitor';
import { sendTaskMessage, type TaskMessageData } from '../../interface/messenger';
import { taskManager } from '../task-manager';

interface GitHubRepo {
  name: string;
  desc: string;
  stars: number;
  url: string;
  lang: string | null;
}

async function fetchGitHubTrendingRepos(): Promise<GitHubRepo[]> {
  try {
    const today = new Date();
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const dateStr = weekAgo.toISOString().split('T')[0];

    const response = await fetch(
      `https://api.github.com/search/repositories?q=created:>${dateStr}&sort=stars&order=desc&per_page=30`,
      {
        headers: {
          Accept: 'application/vnd.github.v3+json',
          'User-Agent': 'VibeCodingBot-Cron-Task',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`GitHub API failed: ${response.status}`);
    }

    const data = (await response.json()) as {
      items: Array<{
        full_name: string;
        description: string | null;
        stargazers_count: number;
        html_url: string;
        language: string | null;
      }>;
    };

    return data.items
      .filter(item => item.stargazers_count >= 50 && item.stargazers_count <= 100000)
      .slice(0, 15)
      .map(item => ({
        name: item.full_name,
        desc: item.description || '无描述',
        stars: item.stargazers_count,
        url: item.html_url,
        lang: item.language,
      }));
  } catch (error) {
    console.error('Failed to fetch GitHub trending repos:', error);
    return [];
  }
}

function selectInterestingRepo(repos: GitHubRepo[]): GitHubRepo | null {
  if (repos.length === 0) return null;

  const interestingKeywords = [
    'ai', 'llm', 'agent', 'gpt', 'claude', 'copilot', 'assistant',
    'framework', 'tool', 'cli', 'sdk', 'api', 'platform',
    'automation', 'bot', 'chatbot', 'assistant',
    'react', 'vue', 'next', 'typescript', 'rust', 'go',
    'machine learning', 'deep learning', 'neural',
  ];

  const scoredRepos = repos.map(repo => {
    let score = Math.log10(repo.stars + 1) * 2;

    const descLower = repo.desc.toLowerCase();
    const nameLower = repo.name.toLowerCase();

    for (const keyword of interestingKeywords) {
      if (descLower.includes(keyword) || nameLower.includes(keyword)) {
        score += 3;
      }
    }

    if (repo.lang && ['TypeScript', 'Rust', 'Go', 'Python'].includes(repo.lang)) {
      score += 2;
    }

    return { repo, score };
  });

  scoredRepos.sort((a, b) => b.score - a.score);

  const topRepos = scoredRepos.slice(0, 5);
  const selected = topRepos[Math.floor(Math.random() * topRepos.length)];
  return selected ? selected.repo : null;
}

async function generateResearchPrompt(): Promise<string> {
  const today = new Date();
  const dateStr = `${today.getFullYear()}年${today.getMonth() + 1}月${today.getDate()}日`;

  const repos = await fetchGitHubTrendingRepos();
  const selectedRepo = selectInterestingRepo(repos);

  let promptContent: string;

  if (selectedRepo) {
    promptContent = `今天是${dateStr}，GitHub上本周热门项目发现：${selectedRepo.name}（${selectedRepo.stars}⭐，语言：${selectedRepo.lang || '未知'}）

项目描述：${selectedRepo.desc}

请对这个项目进行深入研究分析：
1. 项目核心功能和价值主张
2. 技术架构和创新点分析
3. 有意思的实现细节或设计模式
4. 实际应用场景和潜在用例
5. 类似产品或竞品对比分析
6. 发展前景和改进建议

项目地址：${selectedRepo.url}`;
  } else {
    promptContent = `今天是${dateStr}，请搜索GitHub上的热门开源项目，选择一个有意思的项目进行深入研究分析。`;
  }

  return `硅基写手 ${promptContent}`;
}

async function executeCronTask(
  taskName: string,
  commandName: string,
  messenger: MessengerClient,
  chatId: string
): Promise<void> {
  const timestamp = new Date().toISOString();

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`[${timestamp}] Cron task '${taskName}' triggered`);

  try {
    const prompt = await generateResearchPrompt();
    console.log(`Generated prompt: ${prompt}`);

    const context = {
      chatId,
      userId: 0,
      username: `cron:${taskName}`,
      messenger,
      enableMonitoring: true,
    };

    const taskResult = await taskManager.createTask(commandName, prompt, context);
    console.log(`Cron task '${taskName}' created task: ${taskResult.taskId} (${taskResult.status})`);

    if (taskResult.status === 'running') {
      const task = taskManager.getTask(taskResult.taskId);
      if (task) {
        const messageData: TaskMessageData = {
          taskId: taskResult.taskId,
          commandName,
          args: prompt.substring(0, 200),
          sessionName: taskResult.sessionName,
          branchName: taskResult.branchName,
          status: 'running',
          duration: 0,
        };

        const messageId = await sendTaskMessage(messenger, chatId, messageData);
        if (messageId) {
          task.messageId = messageId;
        }

        startMonitoring({
          taskId: taskResult.taskId,
          sessionName: taskResult.sessionName,
          statusFile: task.statusFile,
          messenger,
          chatId,
          taskName: `定时任务: ${taskName}`,
          branchName: taskResult.branchName,
          args: prompt.substring(0, 200),
          messageId: messageId || undefined,
          onCompletion: async (id) => {
            await taskManager.completeTask(id);
          },
          onFailure: async (id, reason, _duration) => {
            await taskManager.failTask(id, `Cron task ended unexpectedly (${reason})`);
          },
        });
      }
    } else if (taskResult.status === 'queued') {
      await messenger.sendMessage(
        chatId,
        `⏳ 定时任务已排队\n\n任务: ${taskName}\n任务ID: ${taskResult.taskId}\n队列位置: ${taskResult.queuePosition}`
      );
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`Cron task '${taskName}' error:`, errorMessage);
    try {
      await messenger.sendMessage(
        chatId,
        `❌ 定时任务异常\n\n任务: ${taskName}\n错误: ${errorMessage}`
      );
    } catch (notifyError) {
      console.error('Failed to send error notification:', notifyError);
    }
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}

export interface CronTaskConfig {
  messenger: MessengerClient;
  chatId: string;
}

export function initializeCronTasks(cronConfig: CronTaskConfig): Cron[] {
  const scheduledJobs: Cron[] = [];
  const taskNames = Object.keys(config.cronTasks);

  if (taskNames.length === 0) {
    console.log('No cron tasks configured');
    return scheduledJobs;
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Initializing cron tasks...');

  const { messenger, chatId } = cronConfig;

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
            messenger,
            chatId
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
      console.log(`  Chat ID: ${chatId}`);
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

export function stopCronJobs(jobs: Cron[]): void {
  console.log('Stopping cron jobs...');
  for (const job of jobs) {
    job.stop();
    console.log(`Stopped cron job: ${job.name || 'unnamed'}`);
  }
  console.log('All cron jobs stopped');
}