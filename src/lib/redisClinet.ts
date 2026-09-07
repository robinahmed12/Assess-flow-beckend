import { createClient } from 'redis';
import config from '../app/config';

export const redisClient = createClient({
    username: config.redis_user,
    password: config.redis_password,
    socket: {
        host: config.redis_host,
        port: Number(config.redis_port)
    }
});

let redisConnectionPromise: Promise<typeof redisClient> | null = null;

export const connectRedis = async () => {
  if (redisClient.isOpen) {
    return redisClient;
  }

  if (!redisConnectionPromise) {
    redisConnectionPromise = redisClient.connect().catch((error) => {
      redisConnectionPromise = null;
      throw error;
    });
  }

  await redisConnectionPromise;
  return redisClient;
};

redisClient.on("error", (error) => {
  console.error("Redis client error", error);
});