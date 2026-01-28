import { execSync, spawn } from 'node:child_process'

const CONTAINER_NAME = 'high-society-e2e-test'
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
  console.log('[1/3] Building Docker image...')
  execSync(`docker build -t ${IMAGE_NAME} .`, {
    stdio: 'inherit',
    cwd: process.cwd().replace('/e2e', ''),
  })

  console.log('[2/3] Starting container...')
  // Stop and remove any existing container
  try {
    execSync(`docker stop ${CONTAINER_NAME}`, { stdio: 'ignore' })
  } catch {
    // Container might not exist
  }
  try {
    execSync(`docker rm ${CONTAINER_NAME}`, { stdio: 'ignore' })
  } catch {
    // Container might not exist
  }

  execSync(
    `docker run -d --name ${CONTAINER_NAME} -p ${PORT}:3001 -e DISCORD_CLIENT_ID=test -e DISCORD_CLIENT_SECRET=test ${IMAGE_NAME}`,
    { stdio: 'inherit', cwd: process.cwd().replace('/e2e', '') }
  )

  console.log('[3/3] Waiting for server to be ready...')
  await waitForServer()
}

export async function teardown(): Promise<void> {
  console.log('Cleaning up...')
  try {
    execSync(`docker stop ${CONTAINER_NAME}`, { stdio: 'ignore' })
  } catch {
    // Ignore errors
  }
  try {
    execSync(`docker rm ${CONTAINER_NAME}`, { stdio: 'ignore' })
  } catch {
    // Ignore errors
  }
}
