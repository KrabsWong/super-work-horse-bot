import type { CommandContext } from '../../interface/messenger/types';
import { executeCommand } from './executor';
import { config } from '../../config';

export async function handleRun(ctx: CommandContext): Promise<void> {
  const args = ctx.args?.trim();

  if (!args) {
    const commandNames = Object.keys(config.commands);
    await ctx.messenger.sendMessage(
      ctx.chatId,
      `❌ 请指定要执行的命令\n\n` +
      `用法: /run <command> <text>\n` +
      `      /run <text> (使用默认命令: ${commandNames[0] || 'research'})\n\n` +
      `可用命令:\n${commandNames.map(c => `  - ${c}`).join('\n')}`
    );
    return;
  }

  const parts = args.split(/\s+/);
  const firstWord = parts[0];
  const commandNames = Object.keys(config.commands);

  let commandName: string;
  let commandArgs: string;

  if (commandNames.includes(firstWord)) {
    commandName = firstWord;
    commandArgs = parts.slice(1).join(' ');
  } else {
    commandName = commandNames[0] || 'research';
    commandArgs = args;
  }

  if (!commandArgs) {
    await ctx.messenger.sendMessage(
      ctx.chatId,
      `❌ 请提供命令参数\n\n` +
      `用法: /run ${commandName} <text>\n\n` +
      `示例:\n` +
      `  /run ${commandName} 帮我生成一份研究报告`
    );
    return;
  }

  const context = {
    userId: Number(ctx.userId),
    username: ctx.username,
    chatId: ctx.chatId,
    messenger: ctx.messenger,
    enableMonitoring: true,
  };

  await ctx.messenger.sendMessage(
    ctx.chatId,
    `▶️ 开始执行命令...\n\n命令: /${commandName}\n参数: ${commandArgs.substring(0, 100)}${commandArgs.length > 100 ? '...' : ''}`
  );

  const result = await executeCommand(commandName, commandArgs, context);

  if (!result.success) {
    await ctx.messenger.sendMessage(
      ctx.chatId,
      `❌ 命令执行失败\n\n错误: ${result.error}`
    );
  }
}
