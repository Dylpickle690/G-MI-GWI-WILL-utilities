import { MessageFlags, PermissionFlagsBits } from 'discord.js';
import { getGuildConfig } from '../../../services/config/guildConfig.js';
import { logger } from '../../../utils/logger.js';

export default {
  name: 'session_role',
  async execute(interaction, client) {
    if (!interaction.inGuild()) {
      await interaction.reply({
        content: 'Session roles can only be managed inside the server.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    try {
      const config = await getGuildConfig(client, interaction.guildId);
      const settings = config.sessionSettings;
      if (!settings?.roleId) {
        await interaction.editReply('Session role assignment is not configured. Ask a server manager to run `/session setup`.');
        return;
      }

      const role = await interaction.guild.roles.fetch(settings.roleId);
      const botMember = interaction.guild.members.me;
      if (!role || role.managed || !botMember?.permissions.has(PermissionFlagsBits.ManageRoles)
        || role.position >= botMember.roles.highest.position) {
        await interaction.editReply('The configured session role is no longer assignable. Ask a server manager to update `/session setup`.');
        return;
      }

      const member = await interaction.guild.members.fetch(interaction.user.id);
      if (member.roles.cache.has(role.id)) {
        await member.roles.remove(role, 'Member opted out of Washington State RP session notifications');
        await interaction.editReply(`Removed ${role} from your roles.`);
      } else {
        await member.roles.add(role, 'Member opted into Washington State RP session notifications');
        await interaction.editReply(`Added ${role} to your roles. You can use this button again to opt out.`);
      }
    } catch (error) {
      logger.error('Failed to toggle session role', {
        guildId: interaction.guildId,
        userId: interaction.user.id,
        error: error.message,
      });
      await interaction.editReply('I could not update your session role. Check the bot role position and Manage Roles permission, then try again.');
    }
  },
};
