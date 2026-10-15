import { execSync, spawn } from 'node:child_process'

const CONTAINER_NAME = 'high-society-e2e-test'
const DB_CONTAINER_NAME = 'high-society-e2e-db'
const NETWORK_NAME = 'high-society-e2e'
const IMAGE_NAME = 'high-society'
const PORT = 3001
const BASE_URL = `http://localhost:${PORT}`

async function waitForServer(maxAttempts = 30): Promise<void> {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const response = await fetch(`${BASE_URL}/up`)
      if (response.ok) {
        console.log('Server is ready!')
        return
      }
    } catch {
      // Server not ready yet
    }
    await new Promise((resolve) => setTimeout(resolve, 1000))
  }
  throw new Error('Server failed to start within timeout')
}

export async function setup(): Promise<void> {
  if (process.env.SKIP_DOCKER_BUILD) {
    console.log('[1/3] Skipping Docker build (using pre-built image)...')
  } else {
    console.log('[1/3] Building Docker image...')
    execSync(`docker build -t ${IMAGE_NAME} .`, {
      stdio: 'inherit',
      cwd: process.cwd().replace('/e2e', ''),
    })
  }

  console.log('[2/3] Starting database and container...')
  cleanup()

  // 容器啟動時會先跑 prisma migrate deploy，所以要有真的 Postgres
  execSync(`docker network create ${NETWORK_NAME}`, { stdio: 'ignore' })
  execSync(
    `docker run -d --name ${DB_CONTAINER_NAME} --network ${NETWORK_NAME} -e POSTGRES_USER=test -e POSTGRES_PASSWORD=test -e POSTGRES_DB=test postgres:17-alpine`,
    { stdio: 'inherit' }
  )
  await waitForDatabase()

  execSync(
    `docker run -d --name ${CONTAINER_NAME} --network ${NETWORK_NAME} -p ${PORT}:3001 -e DISCORD_CLIENT_ID=test -e DISCORD_CLIENT_SECRET=test -e DATABASE_URL=postgresql://test:test@${DB_CONTAINER_NAME}:5432/test ${IMAGE_NAME}`,
    { stdio: 'inherit', cwd: process.cwd().replace('/e2e', '') }
  )

  console.log('[3/3] Waiting for server to be ready...')
  await waitForServer()
}

export async function teardown(): Promise<void> {
  console.log('Cleaning up...')
  cleanup()
}

async function waitForDatabase(maxAttempts = 30): Promise<void> {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      execSync(`docker exec ${DB_CONTAINER_NAME} pg_isready -U test -d test`, { stdio: 'ignore' })
      return
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 1000))
    }
  }
  throw new Error('Database failed to start within timeout')
}

// 移除上一次留下的容器與網路（不存在就略過）
function cleanup(): void {
  for (const cmd of [
    `docker rm -f ${CONTAINER_NAME}`,
    `docker rm -f ${DB_CONTAINER_NAME}`,
    `docker network rm ${NETWORK_NAME}`,
  ]) {
    try {
      execSync(cmd, { stdio: 'ignore' })
    } catch {
      // Might not exist
    }
  }
}
