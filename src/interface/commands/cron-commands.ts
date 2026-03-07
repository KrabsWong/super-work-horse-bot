import type { CommandContext, InlineButton } from '../../interface/messenger/types';
import { scheduler } from '../../core/scheduler';

const TASKS_PER_PAGE = 5;

export async function handleCronList(ctx: CommandContext, page: number = 0, editMode: boolean = false): Promise<void> {
  const tasks = scheduler.listTasks();

  const lines: string[] = [];
  lines.push('━━━━━━━━━━━━━━');
  lines.push('<b>⏰ 定时任务列表</b>');
  lines.push('━━━━━━━━━━━━━━');

  if (tasks.length === 0) {
    lines.push('暂无定时任务');
    lines.push('');
    lines.push('💡 提示: 在 cron/ 目录下创建 .md 文件添加任务');
    lines.push('━━━━━━━━━━━━━━');
    if (editMode && ctx.messageId) {
      await ctx.messenger.editMessage(ctx.chatId, ctx.messageId, lines.join('\n'));
    } else {
      await ctx.messenger.sendMessage(ctx.chatId, lines.join('\n'));
    }
    return;
  }

  const totalPages = Math.ceil(tasks.length / TASKS_PER_PAGE);
  const currentPage = Math.max(0, Math.min(page, totalPages - 1));
  const startIdx = currentPage * TASKS_PER_PAGE;
  const endIdx = Math.min(startIdx + TASKS_PER_PAGE, tasks.length);
  const pageTasks = tasks.slice(startIdx, endIdx);

  lines.push(`📄 第 ${currentPage + 1}/${totalPages} 页 (共 ${tasks.length} 个任务)`);
  lines.push('');

  const buttons: InlineButton[][] = [];

  for (const name of pageTasks) {
    const task = scheduler.getTask(name);
    if (task) {
      const status = task.enabled ? '✅' : '❌';
      const schedule = task.config.schedule;
      const nextRun = task.nextRun
        ? task.nextRun.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })
        : 'N/A';
      const desc = task.config.description.substring(0, 50);

      lines.push(`${status} <b>${name}</b>`);
      lines.push(`   ⏰ ${schedule} | 下次: ${nextRun}`);
      lines.push(`   📝 ${desc}${task.config.description.length > 50 ? '...' : ''}`);
      lines.push('');

      buttons.push([
        { text: `${status} ${name}`, callbackData: `cron:show:${name}:from:${currentPage}` },
      ]);
    }
  }

  lines.push('━━━━━━━━━━━━━━');
  lines.push('💡 点击任务名称查看详情');

  const navButtons: InlineButton[] = [];
  if (currentPage > 0) {
    navButtons.push({ text: '⬅️ 上一页', callbackData: `cron:list:${currentPage - 1}` });
  }
  if (currentPage < totalPages - 1) {
    navButtons.push({ text: '➡️ 下一页', callbackData: `cron:list:${currentPage + 1}` });
  }
  if (navButtons.length > 0) {
    buttons.push(navButtons);
  }

  if (editMode && ctx.messageId) {
    await ctx.messenger.editMessageWithButtons(ctx.chatId, ctx.messageId, lines.join('\n'), buttons);
  } else {
    await ctx.messenger.sendMessageWithButtons(ctx.chatId, lines.join('\n'), buttons);
  }
}

export async function handleCronRun(ctx: CommandContext): Promise<void> {
  const args = ctx.args.trim();

  if (!args) {
    await ctx.messenger.sendMessage(
      ctx.chatId,
      '❌ 请指定要执行的任务名称\n\n用法: /cron run <taskName>'
    );
    return;
  }

  const taskName = args.split(/\s+/)[0];
  const task = scheduler.getTask(taskName);

  if (!task) {
    const tasks = scheduler.listTasks();
    await ctx.messenger.sendMessage(
      ctx.chatId,
      `❌ 未找到定时任务: ${taskName}\n\n可用任务:\n${tasks.map(t => `  - ${t}`).join('\n')}`
    );
    return;
  }

  try {
    const success = await scheduler.runTaskNow(taskName);

    if (!success) {
      await ctx.messenger.sendMessage(
        ctx.chatId,
        `❌ 触发失败\n\n任务: ${taskName}`
      );
    } else if (ctx.messageId) {
      const runningButtons: InlineButton[][] = [
        [
          { text: '⏳ 任务运行中', callbackData: `cron:run:${taskName}` },
          { text: '🔙 返回列表', callbackData: `cron:list:0` },
        ]
      ];
      await ctx.messenger.editMessageWithButtons(
        ctx.chatId, 
        ctx.messageId, 
        `⏳ 任务正在启动...\n\n任务: ${taskName}`,
        runningButtons
      );
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    await ctx.messenger.sendMessage(
      ctx.chatId,
      `❌ 触发异常\n\n任务: ${taskName}\n错误: ${message}`
    );
  }
}

export async function handleCronShow(ctx: CommandContext, fromPage: number = 0): Promise<void> {
  const args = ctx.args.trim();

  if (!args) {
    if (ctx.messageId) {
      await ctx.messenger.editMessage(ctx.chatId, ctx.messageId, '❌ 请指定要查看的任务名称\n\n用法: /cron show <taskName>');
    } else {
      await ctx.messenger.sendMessage(ctx.chatId, '❌ 请指定要查看的任务名称\n\n用法: /cron show <taskName>');
    }
    return;
  }

  const taskName = args.split(/\s+/)[0];
  const task = scheduler.getTask(taskName);

  if (!task) {
    const msg = `❌ 未找到定时任务: ${taskName}`;
    if (ctx.messageId) {
      await ctx.messenger.editMessage(ctx.chatId, ctx.messageId, msg);
    } else {
      await ctx.messenger.sendMessage(ctx.chatId, msg);
    }
    return;
  }

  const lines: string[] = [];
  lines.push('━━━━━━━━━━━━━━');
  lines.push(`<b>⏰ 任务详情: ${taskName}</b>`);
  lines.push('━━━━━━━━━━━━━━');
  lines.push(`<b>状态:</b> ${task.enabled ? '✅ 启用' : '❌ 禁用'}`);
  lines.push(`<b>时间表达式:</b> ${task.config.schedule}`);
  lines.push(`<b>Cron:</b> ${task.config.cronExpression || 'N/A'}`);
  lines.push(`<b>消息平台:</b> ${task.config.messenger}`);

  const nextRun = task.nextRun
    ? task.nextRun.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })
    : 'N/A';
  lines.push(`<b>下次执行:</b> ${nextRun}`);

  if (task.lastRun) {
    const lastRun = new Date(task.lastRun).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
    lines.push(`<b>上次执行:</b> ${lastRun}`);
  }

  lines.push('');
  lines.push('<b>任务描述:</b>');
  lines.push('━━━━━━━━━━━━━━');
  lines.push(task.config.description);
  lines.push('━━━━━━━━━━━━━━');

  const buttons: InlineButton[][] = [
    [
      { text: '▶️ 立即运行', callbackData: `cron:run:${taskName}` },
      { text: '🔙 返回列表', callbackData: `cron:list:${fromPage}` },
    ]
  ];

  if (ctx.messageId) {
    await ctx.messenger.editMessageWithButtons(ctx.chatId, ctx.messageId, lines.join('\n'), buttons);
  } else {
    await ctx.messenger.sendMessageWithButtons(ctx.chatId, lines.join('\n'), buttons);
  }
}

export async function handleCron(ctx: CommandContext): Promise<void> {
  const args = ctx.args.trim().toLowerCase();

  if (!args || args === 'list') {
    return handleCronList(ctx);
  }

  if (args.startsWith('run')) {
    ctx.args = ctx.args.replace(/^run\s*/i, '');
    return handleCronRun(ctx);
  }

  if (args.startsWith('show')) {
    ctx.args = ctx.args.replace(/^show\s*/i, '');
    return handleCronShow(ctx);
  }

  await ctx.messenger.sendMessage(
    ctx.chatId,
    `❌ 未知的子命令: ${args}\n\n用法:\n  /cron - 查看定时任务列表\n  /cron show <name> - 查看任务详情\n  /cron run <name> - 手动触发任务`
  );
}

export async function handleCronCallback(ctx: CommandContext): Promise<void> {
  const data = ctx.args;

  const listMatch = data.match(/^cron:list:(\d+)$/);
  if (listMatch) {
    const page = parseInt(listMatch[1], 10);
    return handleCronList(ctx, page, true);
  }

  const showMatch = data.match(/^cron:show:(.+):from:(\d+)$/);
  if (showMatch) {
    const taskName = showMatch[1];
    const fromPage = parseInt(showMatch[2], 10);
    ctx.args = taskName;
    return handleCronShow(ctx, fromPage);
  }

  const actionMatch = data.match(/^cron:(show|run):(.+)$/);
  if (!actionMatch) {
    return;
  }

  const [, action, taskName] = actionMatch;

  if (action === 'show') {
    ctx.args = taskName;
    return handleCronShow(ctx, 0);
  } else if (action === 'run') {
    ctx.args = taskName;
    return handleCronRun(ctx);
  }
}
