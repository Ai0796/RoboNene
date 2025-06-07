// client/methods/generateSlashCommand.ts
import { SlashCommandBuilder, SlashCommandSubcommandBuilder, SlashCommandSubcommandGroupBuilder } from '@discordjs/builders';
import { ChannelType } from 'discord.js';

interface Choice {
  0: string;
  1: string | number;
}

interface CommandOption {
  type: 'string' | 'boolean' | 'number' | 'channel' | 'user' | 'integer' | 'role';
  name: string;
  description: string;
  required: boolean;
  choices?: Choice[];
  maxLength?: number;
  minLength?: number;
  maxValue?: number;
  minValue?: number;
  channelTypes?: ChannelType[];
  autocomplete?: boolean;
}

export interface CommandInfo {
  name: string;
  utilization?: string; // Optional as not all commands might have it
  description: string;
  ephemeral?: boolean; // Optional
  params?: CommandOption[];
  subcommands?: CommandInfo[]; // Subcommands also follow CommandInfo structure
  adminOnly?: boolean; // Optional
  requiresLink?: boolean; // Optional
  data?: any; // To store the built SlashCommandBuilder
}

/**
 * Applies options to a specific command using SlashCommandBuilder
 * @param {SlashCommandBuilder | SlashCommandSubcommandBuilder | SlashCommandSubcommandGroupBuilder} command the builder for the command in question
 * @param {CommandInfo} info command info provided
 */
const generateOptions = (command: SlashCommandBuilder | SlashCommandSubcommandBuilder | SlashCommandSubcommandGroupBuilder, info: CommandInfo): void => {
  if (info.params) {
    info.params.forEach(option => {
      const setOp = (op: any) => { // Use any for op to handle different builder types
        op.setName(option.name)
          .setDescription(option.description)
          .setRequired(option.required);

        if (option.choices) {
          option.choices.forEach(choice => {
            op.addChoices({ name: choice[0], value: choice[1] });
          });
        }

        if (option.maxLength !== undefined) {
          op.setMaxLength(option.maxLength);
        }

        if (option.minLength !== undefined) {
          op.setMinLength(option.minLength);
        }

        if (option.maxValue !== undefined) {
          op.setMaxValue(option.maxValue);
        }

        if (option.minValue !== undefined) {
          op.setMinValue(option.minValue);
        }

        if (option.channelTypes) {
          op.setChannelTypes(option.channelTypes);
        }

        if (option.autocomplete !== undefined) {
          op.setAutocomplete(option.autocomplete);
        }

        return op;
      };

      if (option.type === 'string') {
        (command as SlashCommandBuilder).addStringOption(setOp);
      } else if (option.type === 'boolean') {
        (command as SlashCommandBuilder).addBooleanOption(setOp);
      } else if (option.type === 'number') {
        (command as SlashCommandBuilder).addNumberOption(setOp);
      } else if (option.type === 'channel') {
        (command as SlashCommandBuilder).addChannelOption(setOp);
      } else if (option.type === 'user') {
        (command as SlashCommandBuilder).addUserOption(setOp);
      } else if (option.type === 'integer') {
        (command as SlashCommandBuilder).addIntegerOption(setOp);
      } else if (option.type === 'role') {
        (command as SlashCommandBuilder).addRoleOption(setOp);
      }
    });
  }
};

/**
 * Builds a slash command using data provided
 * @param {CommandInfo} commandInfo command info provided
 */
const generateSlashCommand = (commandInfo: CommandInfo): SlashCommandBuilder => {
  const slashCommand = new SlashCommandBuilder();

  slashCommand.setName(commandInfo.name);
  slashCommand.setDescription(commandInfo.description);

  generateOptions(slashCommand, commandInfo);

  if (commandInfo.subcommands) {
    commandInfo.subcommands.forEach(scInfo => {
      slashCommand.addSubcommand(sc => {
        sc.setName(scInfo.name)
          .setDescription(scInfo.description);
        generateOptions(sc, scInfo);

        return sc;
      });
    });
  }

  return slashCommand;
};

export default generateSlashCommand;