import { DiscordSDK } from "@discord/embedded-app-sdk";

const clientId = import.meta.env.VITE_DISCORD_CLIENT_ID;

if (!clientId) {
  throw new Error("Missing VITE_DISCORD_CLIENT_ID environment variable");
}

export const discordSdk = new DiscordSDK(clientId);

export function getInstanceId(): string {
  return discordSdk.instanceId;
}

export interface DiscordUser {
  id: string;
  username: string;
  discriminator: string;
  avatar: string | null;
  global_name: string | null;
}

export interface GuildMember {
  nick: string | null;
  avatar: string | null;
}

export interface AuthResult {
  user: DiscordUser;
  accessToken: string;
  guildMember: GuildMember | null;
}

export async function setupDiscordSdk(): Promise<AuthResult> {
  await discordSdk.ready();

  const { code } = await discordSdk.commands.authorize({
    client_id: clientId,
    response_type: "code",
    state: "",
    prompt: "none",
    scope: ["identify", "guilds.members.read"],
  });

  const response = await fetch("/api/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ code }),
  });

  if (!response.ok) {
    throw new Error("Failed to exchange token");
  }

  const { access_token } = await response.json();

  const auth = await discordSdk.commands.authenticate({ access_token });

  if (!auth) {
    throw new Error("Authentication failed");
  }

  // 取得 Guild Member 資訊（包含伺服器別名）
  let guildMember: GuildMember | null = null;
  if (discordSdk.guildId) {
    try {
      const memberResponse = await fetch(
        `https://discord.com/api/users/@me/guilds/${discordSdk.guildId}/member`,
        {
          headers: {
            Authorization: `Bearer ${access_token}`,
          },
        }
      );
      if (memberResponse.ok) {
        const memberData = await memberResponse.json();
        guildMember = {
          nick: memberData.nick,
          avatar: memberData.avatar,
        };
      }
    } catch (e) {
      console.error("Failed to fetch guild member:", e);
    }
  }

  return {
    user: auth.user as DiscordUser,
    accessToken: access_token,
    guildMember,
  };
}
