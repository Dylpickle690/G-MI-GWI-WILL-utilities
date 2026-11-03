import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} from 'discord.js';

export function validateHttpsUrl(value, label) {
  let url;

  try {
    url = new URL(value);
  } catch {
    throw new Error(`${label} must be a valid HTTPS URL.`);
  }

  if (url.protocol !== 'https:') {
    throw new Error(`${label} must use HTTPS.`);
  }

  return url.toString();
}

export function buildSessionEmbed(settings) {
  const active = settings.status === 'active';
  const embed = new EmbedBuilder()
    .setColor(active ? 0x2ecc71 : 0x5865f2)
    .setTitle('🏔️ Washington State RP | Patrol Sessions')
    .setDescription([
      `**Schedule:** ${settings.schedule}`,
      `**Status:** ${active ? '🟢 SESSION IN PROGRESS' : '🔴 NO ACTIVE SESSION'}`,
      settings.startedAt
        ? `**Last started:** <t:${Math.floor(new Date(settings.startedAt).getTime() / 1000)}:F>`
        : null,
      `**Join in-game:** [Connect to the session](${settings.joinUrl})`,
      '',
      'Washington State roleplay · Voice chat only · Strict · Realistic',
    ].filter(Boolean).join('\n'))
    .setFooter({ text: 'Use the button below to get or remove the session role.' });

  if (settings.bannerUrl) {
    embed.setImage(settings.bannerUrl);
  }

  if (settings.startedAt) {
    embed.setTimestamp(new Date(settings.startedAt));
  }

  return embed;
}

export function buildSessionComponents() {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('session_role')
        .setLabel('Get Session Role')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('🎙️'),
    ),
  ];
}
