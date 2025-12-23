<template>
  <div class="flex items-center justify-center min-h-[80vh]">
    <div class="bg-white p-8 rounded shadow-md w-full max-w-md">
      <h1 class="text-2xl font-bold mb-6 text-center">Login</h1>
      <form @submit.prevent="handleLogin" class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-700">Email</label>
          <input v-model="email" type="email" required class="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2" />
        </div>
        <!-- Magic Link Login -->
        <button type="submit" :disabled="loading" class="w-full bg-blue-600 text-white p-2 rounded hover:bg-blue-700 disabled:opacity-50">
          {{ loading ? 'Sending Magic Link...' : 'Send Magic Link' }}
        </button>
      </form>
      <div v-if="message" class="mt-4 text-center text-sm text-green-600">
        {{ message }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const supabase = useSupabaseClient()
const user = useSupabaseUser()
const router = useRouter()

const email = ref('')
const loading = ref(false)
const message = ref('')

// If already logged in, redirect
if (user.value) {
  router.push('/')
}

const handleLogin = async () => {
  loading.value = true
  const { error } = await supabase.auth.signInWithOtp({
    email: email.value,
  })
  if (error) {
    alert(error.message)
  } else {
    message.value = 'Check your email for the login link!'
  }
  loading.value = false
}
</script>
