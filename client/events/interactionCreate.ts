// client/events/interactionCreate.ts
/**
 * @fileoverview Event handler that is run whenever the bot receives an interaction
 * Based on the status of the interaction, the bot may forward the payload to be run
 * as a command, or reject the data.
 * @author Potor10
 */

import { DMChannel, Events, Interaction, CommandInteraction, AutocompleteInteraction, ModalSubmitInteraction, PermissionsBitField, ChannelType } from 'discord.js';
import generateEmbed from '../methods/generateEmbed';
import DiscordClient from '../client/client'; // Assuming default export

// General constants used to reply to standard interactions
const INTERACTION_CONST = {
  'NO_ACCESS_ADMIN': {
    type: 'Error',
    message: 'You can not access this command.\nPlease make sure you have ' +
      '``Administrator`` or ``Manage Server`` permissions.'
  },

  'NO_ACCESS_LINK': {
    type: 'Error',
    message: 'You can not access this command until you link your Discord to a Project Sekai account.\nUse /link to begin.'
  }
};

export default {
  name: Events.InteractionCreate,
  async execute(interaction: Interaction, discordClient: DiscordClient) {
    if (interaction.isAutocomplete()) {
      const autocompleteInteraction = interaction as AutocompleteInteraction;
      const interactionIdx = discordClient.commands
        .map(c => c.data.name)
        .indexOf(autocompleteInteraction.commandName);
      if (interactionIdx !== -1) {
        const command = discordClient.commands[interactionIdx];
        if (command.autocomplete) {
          try {
            await command.autocomplete(autocompleteInteraction, discordClient);
          } catch (error) {
            console.error('Error during autocomplete:', error);
          }
        }
      }
      return;
    }

    if (interaction.isModalSubmit()) {
      const modalSubmitInteraction = interaction as ModalSubmitInteraction;
      console.log('Modal submit interaction received');
      const interactionIdx = discordClient.commands
        .map(c => c.data.name)
        .indexOf(modalSubmitInteraction.customId); // customId used here for modal submit
      if (interactionIdx !== -1) {
        const command = discordClient.commands[interactionIdx];
        if (command.modalSubmit) {
          try {
            await command.modalSubmit(modalSubmitInteraction, discordClient);
          } catch (error) {
            console.error('Error during modal submit:', error);
          }
        }
      }
      return;
    }

    if (!interaction.isCommand()) return;

    const commandInteraction = interaction as CommandInteraction; // Asserting as CommandInteraction once isCommand is true

    discordClient.logger?.log({ // Optional chaining for logger
      level: 'info',
      timestamp: Date.now(),
      discord_id: commandInteraction.user.id,
      discord_name: `${commandInteraction.user.username}#${commandInteraction.user.discriminator}`,
      guild_id: commandInteraction.guildId,
      command: commandInteraction.commandName,
      subcommand: commandInteraction.options instanceof (require('discord.js')).CommandInteractionOptionResolver ? (commandInteraction.options as any)._subcommand : undefined, // Check if CommandInteractionOptionResolver is present and access _subcommand
      inputs: commandInteraction.options instanceof (require('discord.js')).CommandInteractionOptionResolver ? (commandInteraction.options as any)._hoistedOptions : undefined // Check and access _hoistedOptions
    });

    const interactionIdx = discordClient.commands
      .map(c => c.data.name)
      .indexOf(commandInteraction.commandName);


    if (interactionIdx !== -1) {
      const command = discordClient.commands[interactionIdx];

      if (command.adminOnly) {
        // Check for server manager / administrate perms
        // interaction.member is GuildMember | APIInteractionGuildMember | null
        const permissions = commandInteraction.member?.permissions;
        if (!permissions || !(permissions instanceof PermissionsBitField) || (!permissions.has(PermissionsBitField.Flags.Administrator) && !permissions.has(PermissionsBitField.Flags.ManageGuild))) {
          await commandInteraction.reply({
            embeds: [
              generateEmbed({
                name: command.data.name,
                content: INTERACTION_CONST.NO_ACCESS_ADMIN,
                client: discordClient.client
              })
            ],
            ephemeral: true
          });
          return;
        }
      }

      if (command.requiresLink) {
        const request = discordClient.db?.prepare('SELECT * FROM users ' +
          'WHERE discord_id=@discordId').all({
            discordId: commandInteraction.user.id
          });
        if (!request || request.length === 0) { // Check for null/undefined request or empty array
          await commandInteraction.reply({
            embeds: [
              generateEmbed({
                name: command.data.name,
                content: INTERACTION_CONST.NO_ACCESS_LINK,
                client: discordClient.client
              })
            ],
            ephemeral: true
          });
          return;
        }
      }
      try {
        await command.execute(commandInteraction, discordClient);
      } catch (error) {
        console.error(`Error executing command ${commandInteraction.commandName}:`, error);
      }
    }
  }
};