<template>
  <div class="flex items-center justify-center min-h-[80vh]">
    <div class="bg-white p-8 rounded shadow-md w-full max-w-md">
      <h1 class="text-2xl font-bold mb-6 text-center">Login</h1>
      <form @submit.prevent="handleLogin" class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-700">Email</label>
          <input v-model="email" type="email" required class="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2" />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700">Password</label>
          <input v-model="password" type="password" required class="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2" />
        </div>
        <button type="submit" :disabled="loading" class="w-full bg-blue-600 text-white p-2 rounded hover:bg-blue-700 disabled:opacity-50">
          {{ loading ? 'Logging In...' : 'Login' }}
        </button>
      </form>
      <div v-if="message" class="mt-4 text-center text-sm text-green-600">
        {{ message }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const user = useCookie('pb_auth')
const router = useRouter()

const email = ref('')
const password = ref('')
const loading = ref(false)
const message = ref('')

// If already logged in, redirect
if (user.value) {
  router.push('/')
}

const handleLogin = async () => {
  loading.value = true
  try {
    const response: any = await $fetch('/api/auth/login', {
      method: 'POST',
      body: {
        email: email.value,
        password: password.value
      }
    })

    // Update local cookie state so reactivity picks it up
    user.value = { token: response.token, model: response.user }

    message.value = 'Success! Redirecting...'
    router.push('/')
  } catch (error: any) {
    alert(error.data?.statusMessage || error.message || 'Error logging in')
  } finally {
    loading.value = false
  }
}
</script>
