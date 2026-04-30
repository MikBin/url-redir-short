import { recordRequest } from './monitoring'

class AdminMetrics {
  public requestsTotal = {
    inc: ({ status }: { status: number }) => {
      // We rely on requestDuration.observe to record both count and duration in recordRequest
      // But we can check if it's an error based on status code
      // We will delegate to recordRequest in observe to get duration.
    }
  }

  public requestDuration = {
    observe: ({ status }: { status: number }, durationSeconds: number) => {
      const isError = status >= 400
      recordRequest(durationSeconds * 1000, isError)
    }
  }
}

export const metrics = new AdminMetrics()
