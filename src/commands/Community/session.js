import {
  ChannelType,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from 'discord.js';
import { getGuildConfig, setGuildConfig } from '../../services/config/guildConfig.js';
import {
  buildSessionComponents,
  buildSessionEmbed,
  validateHttpsUrl,
} from '../../services/sessionService.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { logger } from '../../utils/logger.js';

const SESSION_PERMISSION = PermissionFlagsBits.ManageGuild;

async function getSettings(client, guildId) {
  const config = await getGuildConfig(client, guildId);
  return { config, settings: config.sessionSettings ?? null };
}

async function updatePanel(guild, settings) {
  const channel = await guild.channels.fetch(settings.channelId);
  if (!channel?.isTextBased()) {
    throw new Error('The configured session panel channel is missing or is not a text channel. Run `/session setup` again.');
  }

  const message = await channel.messages.fetch(settings.messageId);
  await message.edit({
    embeds: [buildSessionEmbed(settings)],
    components: buildSessionComponents(),
  });
}

export default {
  data: new SlashCommandBuilder()
    .setName('session')
    .setDescription('Manage Washington State RP patrol sessions')
    .setDMPermission(false)
    .setDefaultMemberPermissions(SESSION_PERMISSION)
    .addSubcommand(subcommand => subcommand
      .setName('setup')
      .setDescription('Configure the session panel, schedule, and join link')
      .addChannelOption(option => option
        .setName('channel')
        .setDescription('Text channel where the session panel is posted')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(true))
      .addRoleOption(option => option
        .setName('role')
        .setDescription('Role members can opt into for session notifications')
        .setRequired(true))
      .addStringOption(option => option
        .setName('schedule')
        .setDescription('Session schedule, including its timezone')
        .setMaxLength(500)
        .setRequired(true))
      .addStringOption(option => option
        .setName('join_url')
        .setDescription('HTTPS link used to join the in-game session')
        .setMaxLength(500)
        .setRequired(true))
      .addStringOption(option => option
        .setName('banner_url')
        .setDescription('Optional HTTPS Washington RP banner image')
        .setMaxLength(500)
        .setRequired(false)))
    .addSubcommand(subcommand => subcommand
      .setName('start')
      .setDescription('Mark the configured patrol session as active'))
    .addSubcommand(subcommand => subcommand
      .setName('end')
      .setDescription('Mark the configured patrol session as ended'))
    .addSubcommand(subcommand => subcommand
      .setName('status')
      .setDescription('Show the configured session panel status')),
  category: 'community',

  async execute(interaction, _guildConfig, client) {
    if (!interaction.memberPermissions?.has(SESSION_PERMISSION)) {
      await interaction.reply({
        content: 'You need **Manage Server** to manage patrol sessions.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (!(await InteractionHelper.safeDefer(interaction, { flags: MessageFlags.Ephemeral }))) {
      return;
    }

    const subcommand = interaction.options.getSubcommand();

    try {
      const { config, settings } = await getSettings(client, interaction.guildId);

      if (subcommand === 'setup') {
        const channel = interaction.options.getChannel('channel');
        const role = interaction.options.getRole('role');
        const schedule = interaction.options.getString('schedule').trim();
        const joinUrl = validateHttpsUrl(interaction.options.getString('join_url'), 'Join link');
        const bannerValue = interaction.options.getString('banner_url');
        const bannerUrl = bannerValue ? validateHttpsUrl(bannerValue, 'Banner link') : null;
        const botMember = interaction.guild.members.me;

        if (!schedule) {
          throw new Error('Provide the patrol schedule and its timezone.');
        }
        if (!botMember?.permissions.has(PermissionFlagsBits.ManageRoles)
          || role.managed
          || role.id === interaction.guild.id
          || role.position >= botMember.roles.highest.position) {
          throw new Error('I cannot assign that session role. Give me Manage Roles and choose a non-managed role below my highest role.');
        }

        const nextSettings = {
          channelId: channel.id,
          roleId: role.id,
          schedule,
          joinUrl,
          bannerUrl,
          status: settings?.status === 'active' ? 'active' : 'offline',
          startedAt: settings?.startedAt ?? null,
          endedAt: settings?.endedAt ?? null,
        };
        const panel = await channel.send({
          embeds: [buildSessionEmbed(nextSettings)],
          components: buildSessionComponents(),
        });

        nextSettings.messageId = panel.id;
        try {
          await setGuildConfig(client, interaction.guildId, {
            ...config,
            sessionSettings: nextSettings,
          });
        } catch (error) {
          await panel.delete().catch(cleanupError => {
            logger.warn('Could not remove session panel after saving settings failed', {
              guildId: interaction.guildId,
              messageId: panel.id,
              error: cleanupError.message,
            });
          });
          throw error;
        }

        await interaction.editReply(`Washington State RP session panel configured in ${channel}. Schedule: **${schedule}**.`);
        return;
      }

      if (!settings?.channelId || !settings?.messageId) {
        await interaction.editReply('Sessions are not configured. A server manager must run `/session setup` first.');
        return;
      }

      if (subcommand === 'status') {
        await interaction.editReply({
          embeds: [buildSessionEmbed(settings)],
          components: buildSessionComponents(),
        });
        return;
      }

      const nextSettings = {
        ...settings,
        status: subcommand === 'start' ? 'active' : 'offline',
        ...(subcommand === 'start'
          ? { startedAt: new Date().toISOString(), endedAt: null }
          : { endedAt: new Date().toISOString() }),
      };

      await setGuildConfig(client, interaction.guildId, {
        ...config,
        sessionSettings: nextSettings,
      });
      await updatePanel(interaction.guild, nextSettings);
      await interaction.editReply(
        subcommand === 'start'
          ? 'The Washington State RP patrol session is now marked **in progress**.'
          : 'The Washington State RP patrol session is now marked **offline**.',
      );
    } catch (error) {
      logger.error('Session command failed', {
        guildId: interaction.guildId,
        userId: interaction.user.id,
        subcommand,
        error: error.message,
      });
      await interaction.editReply(`Session operation failed: ${error.message}`);
    }
  },
};
