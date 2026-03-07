import type { CommandContext } from '../../interface/messenger/types';
import { scheduler } from '../../core/scheduler';

export async function handleCronList(ctx: CommandContext): Promise<void> {
  const tasks = scheduler.listTasks();

  const lines: string[] = [];
  lines.push('━━━━━━━━━━━━━━━━━━');
  lines.push('⏰ 定时任务列表');
  lines.push('━━━━━━━━━━━━━━━━━━');

  if (tasks.length === 0) {
    lines.push('暂无定时任务');
    lines.push('');
    lines.push('💡 提示: 在 cron/ 目录下创建 .md 文件添加任务');
  } else {
    for (const name of tasks) {
      const task = scheduler.getTask(name);
      if (task) {
        const status = task.enabled ? '✅' : '❌';
        const schedule = task.config.schedule;
        const nextRun = task.nextRun
          ? task.nextRun.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })
          : 'N/A';
        const desc = task.config.description.substring(0, 60);
        
        lines.push(`${status} ${name}`);
        lines.push(`   时间: ${schedule}`);
        lines.push(`   下次: ${nextRun}`);
        lines.push(`   描述: ${desc}${task.config.description.length > 60 ? '...' : ''}`);
        lines.push('');
      }
    }
  }

  lines.push('━━━━━━━━━━━━━━━━━━');

  await ctx.messenger.sendMessage(ctx.chatId, lines.join('\n'));
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

  await ctx.messenger.sendMessage(
    ctx.chatId,
    `▶️ 正在触发定时任务...\n\n任务: ${taskName}\n时间: ${task.config.schedule}`
  );

  try {
    const success = await scheduler.runTaskNow(taskName);
    
    if (success) {
      await ctx.messenger.sendMessage(
        ctx.chatId,
        `✅ 定时任务已触发\n\n任务: ${taskName}\n请查看后续执行报告`
      );
    } else {
      await ctx.messenger.sendMessage(
        ctx.chatId,
        `❌ 触发失败\n\n任务: ${taskName}`
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

export async function handleCronShow(ctx: CommandContext): Promise<void> {
  const args = ctx.args.trim();

  if (!args) {
    await ctx.messenger.sendMessage(
      ctx.chatId,
      '❌ 请指定要查看的任务名称\n\n用法: /cron show <taskName>'
    );
    return;
  }

  const taskName = args.split(/\s+/)[0];
  const task = scheduler.getTask(taskName);

  if (!task) {
    await ctx.messenger.sendMessage(ctx.chatId, `❌ 未找到定时任务: ${taskName}`);
    return;
  }

  const lines: string[] = [];
  lines.push('━━━━━━━━━━━━━━━━━━');
  lines.push(`⏰ 定时任务详情: ${taskName}`);
  lines.push('━━━━━━━━━━━━━━━━━━');
  lines.push(`状态: ${task.enabled ? '✅ 启用' : '❌ 禁用'}`);
  lines.push(`时间表达式: ${task.config.schedule}`);
  lines.push(`Cron: ${task.config.cronExpression || 'N/A'}`);
  lines.push(`消息平台: ${task.config.messenger}`);
  
  const nextRun = task.nextRun
    ? task.nextRun.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })
    : 'N/A';
  lines.push(`下次执行: ${nextRun}`);

  if (task.lastRun) {
    const lastRun = new Date(task.lastRun).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
    lines.push(`上次执行: ${lastRun}`);
  }

  lines.push('');
  lines.push('任务描述:');
  lines.push('━━━━━━━━━━━━━━━━━━');
  lines.push(task.config.description);
  lines.push('━━━━━━━━━━━━━━━━━━');

  await ctx.messenger.sendMessage(ctx.chatId, lines.join('\n'));
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
