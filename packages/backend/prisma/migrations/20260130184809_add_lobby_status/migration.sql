-- CreateEnum
CREATE TYPE "PlayerRole" AS ENUM ('observer', 'player');

-- CreateEnum
CREATE TYPE "RoomStatus" AS ENUM ('lobby', 'playing');

-- AlterTable
ALTER TABLE "players" ADD COLUMN     "is_ready" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "role" "PlayerRole" NOT NULL DEFAULT 'observer';

-- AlterTable
ALTER TABLE "rooms" ADD COLUMN     "status" "RoomStatus" NOT NULL DEFAULT 'lobby';
