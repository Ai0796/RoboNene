// client/commands/restart.ts
/**
 * @fileoverview The main output when users call for the /about command
 * Will create a scrollable leaderboard elaborating about the bot and other features
 * @author Potor10
 */

import * as COMMAND from '../command_data/restart'; // Assuming command_data/restart.ts is converted
import generateSlashCommand from '../methods/generateSlashCommand';
import * as APP from 'process'; // Import process module
import * as fs from 'fs';
import { PermissionFlagsBits, CommandInteraction, TextBasedChannel, PermissionsBitField } from 'discord.js'; // Import necessary types
import DiscordClient from '../client'; // Assuming default export

// Helper function to check if a member has manage messages permissions
function isAdmin(interaction: CommandInteraction): boolean {
  try {
    const memberPermissions = interaction.member?.permissions;
    if (memberPermissions && typeof memberPermissions !== 'string' && memberPermissions instanceof PermissionsBitField) {
      return memberPermissions.has(PermissionFlagsBits.ManageMessages);
    }
    return false;
  } catch (e) {
    console.error('Error checking admin permissions:', e);
    return false;
  }
}

// Function to add a message to messages.json for persistence after restart
function addMessage(message: string, channelId: string): void {
  let trackFile: { [key: string]: string } = {}; // Explicitly type trackFile
  try {
    // Read existing messages if file exists
    if (fs.existsSync('messages.json')) {
      trackFile = JSON.parse(fs.readFileSync('messages.json', 'utf8'));
    }

    trackFile[channelId] = message; // Store message by channel ID

    fs.writeFile('messages.json', JSON.stringify(trackFile), err => {
      if (err) {
        console.error('Error writing messages.json for restart:', err); // Changed to console.error
      } else {
        console.log('Wrote messages.json Successfully');
      }
    });
  } catch (e: any) { // Type as any for error
    console.error('Error occurred while writing messages.json:', e); // Changed to console.error
  }
}

export default {
  ...COMMAND.INFO,
  data: generateSlashCommand(COMMAND.INFO),

  async execute(interaction: CommandInteraction, discordClient: DiscordClient) { // Explicitly type interaction
    await interaction.deferReply({
      ephemeral: COMMAND.INFO.ephemeral
    });

    // Check if the user is an admin and the guild ID matches a specific one (e.g., bot's control server)
    // The original code uses a hardcoded guild ID '967923753470291978'
    if (isAdmin(interaction) && interaction.guildId === '967923753470291978') {
      try {
        // First I create an exec command which is executed before current process is killed
        const cmd = 'pm2 restart 0'; // Assuming pm2 is installed and process ID 0 is the bot

        // Then I look if there's already something else killing the process
        // Using `APP.killed` as a flag, though this is not a standard Node.js property
        // In a real TS app, a more robust flag system or process management would be used.
        if (!(APP as any).killed) { // Type assertion as 'killed' might not be on 'process' type
          (APP as any).killed = true; // Set the flag

          // Then I execute the command and kill the app if starting was successful
          const { exec } = await import('child_process'); // Dynamic import for child_process
          await interaction.editReply('Restarting Application');

          // Store message to be sent after restart
          if (interaction.channel) {
            addMessage('Application Restarted Successfully', interaction.channel.id);
          } else {
            console.warn('Interaction channel is null, cannot add restart success message.');
          }

          exec(cmd, (error, stdout, stderr) => {
            if (error) {
              console.error(`exec error: ${error}`);
              interaction.followUp('Application Restarted: Failure');
              (APP as any).killed = false; // Reset flag on failure
              return;
            }
            console.log(`stdout: ${stdout}`);
            console.error(`stderr: ${stderr}`);
            APP.exit(0); // Exit the process
          });
        } else {
          await interaction.editReply('A restart is already in progress.');
        }
      } catch (e: any) { // Type as any for error
        console.error('Error during restart command:', e); // Changed to console.error
        await interaction.editReply('Application Restarted: Failure');
      }
    } else {
      await interaction.editReply('You do not have the permissions for that.');
    }
  }
};