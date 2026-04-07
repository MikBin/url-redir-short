<template>
  <div class="flex items-center justify-center min-h-[80vh]">
    <div class="bg-white p-8 rounded shadow-md w-full max-w-md">
      <h1 class="text-2xl font-bold mb-6 text-center">Register</h1>
      <form @submit.prevent="handleRegister" class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-700">Name (optional)</label>
          <input v-model="name" type="text" class="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2" />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700">Email</label>
          <input v-model="email" type="email" required class="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2" />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700">Password</label>
          <input v-model="password" type="password" required class="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2" />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700">Confirm Password</label>
          <input v-model="passwordConfirm" type="password" required class="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2" />
        </div>
        <button type="submit" :disabled="loading" class="w-full bg-blue-600 text-white p-2 rounded hover:bg-blue-700 disabled:opacity-50">
          {{ loading ? 'Registering...' : 'Register' }}
        </button>
      </form>
      <div v-if="errorMsg" class="mt-4 text-center text-sm text-red-600">
        {{ errorMsg }}
      </div>
      <div class="mt-4 text-center text-sm">
        Already have an account? <NuxtLink to="/login" class="text-blue-600 hover:underline">Login here</NuxtLink>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const router = useRouter()
const pbAuth = useCookie('pb_auth')

const name = ref('')
const email = ref('')
const password = ref('')
const passwordConfirm = ref('')
const loading = ref(false)
const errorMsg = ref('')

if (pbAuth.value) {
  router.push('/')
}

const handleRegister = async () => {
  if (password.value !== passwordConfirm.value) {
    errorMsg.value = 'Passwords do not match'
    return
  }

  loading.value = true
  errorMsg.value = ''
  try {
    await $fetch('/api/auth/register', {
      method: 'POST',
      body: {
        email: email.value,
        password: password.value,
        passwordConfirm: passwordConfirm.value,
        name: name.value
      }
    })
    router.push('/')
  } catch (err: any) {
    errorMsg.value = err.data?.statusMessage || 'Registration failed'
  } finally {
    loading.value = false
  }
}
</script>
