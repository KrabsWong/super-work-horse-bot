import type { CommandContext } from "../../interface/messenger/types";
import { taskManager } from "../../core/task-manager";
import { TaskStatus } from "../../types";

export async function handleJobsList(ctx: CommandContext): Promise<void> {
  const runningTasks = taskManager.getRunningTasks();
  const queuedTasks = taskManager.getQueuedTasks();

  const lines: string[] = [];
  lines.push("━━━━━━━━━━━━━━━━━━");
  lines.push("📋 任务状态");
  lines.push("━━━━━━━━━━━━━━━━━━");

  if (runningTasks.length === 0 && queuedTasks.length === 0) {
    lines.push("暂无任务运行中或排队中");
  } else {
    if (runningTasks.length > 0) {
      lines.push("");
      lines.push(`▶️ 运行中 (${runningTasks.length})`);
      lines.push("━━━━━━━━━━━━━━━━━━");
      for (const task of runningTasks) {
        const duration = task.startedAt
          ? Math.round((Date.now() - task.startedAt) / 1000)
          : 0;
        const args =
          task.args.length > 100
            ? task.args.substring(0, 100) + "..."
            : task.args;
        lines.push(`🆔 ${task.id}`);
        lines.push(`   命令: /${task.commandName}`);
        lines.push(`   参数: ${args}`);
        lines.push(`   会话: ${task.sessionName}`);
        lines.push(`   时长: ${duration}s`);
      }
    }

    if (queuedTasks.length > 0) {
      lines.push("");
      lines.push(`⏳ 排队中 (${queuedTasks.length})`);
      lines.push("━━━━━━━━━━━━━━━━━━");
      for (const task of queuedTasks) {
        const position = taskManager.getQueuePosition(task.id);
        const args =
          task.args.length > 100
            ? task.args.substring(0, 100) + "..."
            : task.args;
        lines.push(`🆔 ${task.id}`);
        lines.push(`   命令: /${task.commandName}`);
        lines.push(`   参数: ${args}`);
        lines.push(`   位置: #${position}`);
      }
    }
  }

  lines.push("━━━━━━━━━━━━━━━━━━");

  await ctx.messenger.sendMessage(ctx.chatId, lines.join("\n"));
}

export async function handleJobsStop(ctx: CommandContext): Promise<void> {
  const args = ctx.args.trim();

  if (!args) {
    await ctx.messenger.sendMessage(
      ctx.chatId,
      "❌ 请指定要停止的任务ID\n\n用法: /jobs stop <taskId>",
    );
    return;
  }

  const taskId = args.split(/\s+/)[0];
  const task = taskManager.getTask(taskId);

  if (!task) {
    await ctx.messenger.sendMessage(ctx.chatId, `❌ 未找到任务: ${taskId}`);
    return;
  }

  if (task.status === TaskStatus.RUNNING) {
    await ctx.messenger.sendMessage(
      ctx.chatId,
      `⚠️ 无法停止正在运行的任务\n\n任务ID: ${taskId}\n请等待任务完成或手动终止 tmux 会话: ${task.sessionName}`,
    );
    return;
  }

  const cancelled = taskManager.cancelTask(taskId);

  if (cancelled) {
    await ctx.messenger.sendMessage(
      ctx.chatId,
      `✅ 任务已取消\n\n任务ID: ${taskId}\n命令: /${task.commandName}`,
    );
  } else {
    await ctx.messenger.sendMessage(
      ctx.chatId,
      `❌ 无法取消任务\n\n任务ID: ${taskId}\n状态: ${task.status}`,
    );
  }
}

export async function handleJobsShow(ctx: CommandContext): Promise<void> {
  const args = ctx.args.trim();

  if (!args) {
    await ctx.messenger.sendMessage(
      ctx.chatId,
      "❌ 请指定要查看的任务ID\n\n用法: /jobs show <taskId>",
    );
    return;
  }

  const taskId = args.split(/\s+/)[0];
  const task = taskManager.getTask(taskId);

  if (!task) {
    await ctx.messenger.sendMessage(ctx.chatId, `❌ 未找到任务: ${taskId}`);
    return;
  }

  const lines: string[] = [];
  lines.push("━━━━━━━━━━━━━━━━━━");
  lines.push(`📋 任务详情: ${taskId}`);
  lines.push("━━━━━━━━━━━━━━━━━━");
  lines.push(`命令: /${task.commandName}`);
  lines.push(`状态: ${formatStatus(task.status)}`);
  lines.push(`参数: ${task.args}`);
  lines.push(`会话: ${task.sessionName}`);
  lines.push(`分支: ${task.branchName}`);

  if (task.worktreePath) {
    lines.push(`工作目录: ${task.worktreePath}`);
  }

  const createdAt = new Date(task.createdAt).toLocaleString("zh-CN", {
    timeZone: "Asia/Shanghai",
  });
  lines.push(`创建时间: ${createdAt}`);

  if (task.startedAt) {
    const startedAt = new Date(task.startedAt).toLocaleString("zh-CN", {
      timeZone: "Asia/Shanghai",
    });
    lines.push(`开始时间: ${startedAt}`);

    if (task.status === TaskStatus.RUNNING) {
      const duration = Math.round((Date.now() - task.startedAt) / 1000);
      lines.push(`运行时长: ${duration}s`);
    }
  }

  if (task.completedAt) {
    const completedAt = new Date(task.completedAt).toLocaleString("zh-CN", {
      timeZone: "Asia/Shanghai",
    });
    lines.push(`完成时间: ${completedAt}`);
  }

  if (task.error) {
    lines.push(`错误: ${task.error}`);
  }

  lines.push("━━━━━━━━━━━━━━━━━━");

  await ctx.messenger.sendMessage(ctx.chatId, lines.join("\n"));
}

function formatStatus(status: TaskStatus): string {
  switch (status) {
    case TaskStatus.PENDING:
      return "⏳ 排队中";
    case TaskStatus.RUNNING:
      return "▶️ 运行中";
    case TaskStatus.COMPLETED:
      return "✅ 已完成";
    case TaskStatus.FAILED:
      return "❌ 失败";
    case TaskStatus.CANCELLED:
      return "🚫 已取消";
    default:
      return status;
  }
}

export async function handleJobs(ctx: CommandContext): Promise<void> {
  const args = ctx.args.trim().toLowerCase();

  if (!args || args === "list") {
    return handleJobsList(ctx);
  }

  if (args.startsWith("stop")) {
    ctx.args = ctx.args.replace(/^stop\s*/i, "");
    return handleJobsStop(ctx);
  }

  if (args.startsWith("show")) {
    ctx.args = ctx.args.replace(/^show\s*/i, "");
    return handleJobsShow(ctx);
  }

  await ctx.messenger.sendMessage(
    ctx.chatId,
    `❌ 未知的子命令: ${args}\n\n用法:\n  /jobs - 查看任务列表\n  /jobs show <id> - 查看任务详情\n  /jobs stop <id> - 取消任务`,
  );
}
