import "server-only";
import { AccessToken, RoomServiceClient } from "livekit-server-sdk";

const LIVEKIT_URL = process.env.LIVEKIT_URL;
const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY;
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET;

const normalizeApiUrl = (url?: string) => {
  if (!url) return url;
  if (url.startsWith("wss://")) return `https://${url.slice(6)}`;
  if (url.startsWith("ws://")) return `http://${url.slice(5)}`;
  return url;
};

export function livekitEnabled() {
  return Boolean(LIVEKIT_URL && LIVEKIT_API_KEY && LIVEKIT_API_SECRET);
}

export function getLiveKitRoomService() {
  if (!livekitEnabled()) return null;
  return new RoomServiceClient(
    normalizeApiUrl(LIVEKIT_URL) as string,
    LIVEKIT_API_KEY as string,
    LIVEKIT_API_SECRET as string,
  );
}

export async function ensureLiveKitRoom(roomName: string) {
  const roomService = getLiveKitRoomService();
  if (!roomService) return null;
  try {
    await roomService.createRoom({ name: roomName, emptyTimeout: 60 * 10 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : String(error);
    if (!message.includes("already exists")) {
      throw error;
    }
  }
  return roomName;
}

type TokenOptions = {
  identity: string;
  name?: string;
  roomName: string;
  canPublish: boolean;
  canSubscribe: boolean;
};

export async function createLiveKitToken({
  identity,
  name,
  roomName,
  canPublish,
  canSubscribe,
}: TokenOptions) {
  if (!livekitEnabled()) return null;
  const token = new AccessToken(
    LIVEKIT_API_KEY as string,
    LIVEKIT_API_SECRET as string,
    { identity, name },
  );
  token.addGrant({
    room: roomName,
    roomJoin: true,
    canPublish,
    canSubscribe,
    canPublishData: true,
  });
  return await token.toJwt();
}
