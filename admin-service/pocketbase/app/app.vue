<template>
  <div class="min-h-screen bg-gray-100 flex flex-col">
    <!-- Global Header Navigation -->
    <header class="bg-white shadow">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div class="flex items-center">
          <NuxtLink to="/" class="text-xl font-bold text-blue-600 mr-8">Admin</NuxtLink>
          <nav class="flex space-x-4">
            <NuxtLink to="/" class="text-gray-600 hover:text-blue-600 px-3 py-2 rounded-md text-sm font-medium" active-class="text-blue-600 bg-gray-50">Home</NuxtLink>
            <NuxtLink to="/analytics" class="text-gray-600 hover:text-blue-600 px-3 py-2 rounded-md text-sm font-medium" active-class="text-blue-600 bg-gray-50">Analytics</NuxtLink>
            <NuxtLink to="/domains" class="text-gray-600 hover:text-blue-600 px-3 py-2 rounded-md text-sm font-medium" active-class="text-blue-600 bg-gray-50">Domains</NuxtLink>
          </nav>
        </div>
        <div class="flex items-center space-x-4">
          <NuxtLink v-if="!pbAuth" to="/login" class="text-gray-600 hover:text-blue-600 text-sm font-medium">Login</NuxtLink>
          <NuxtLink v-if="!pbAuth" to="/register" class="text-gray-600 hover:text-blue-600 text-sm font-medium">Register</NuxtLink>
          <button v-if="pbAuth" @click="handleLogout" class="text-red-600 hover:text-red-800 text-sm font-medium">Logout</button>
        </div>
      </div>
    </header>

    <!-- Main Content -->
    <main class="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <NuxtPage />
    </main>
  </div>
</template>

<script setup>
const router = useRouter()
const pbAuth = useCookie('pb_auth')

const handleLogout = async () => {
  try {
    await $fetch('/api/auth/logout', { method: 'POST' })
    pbAuth.value = null
    router.push('/login')
  } catch (err) {
    console.error('Logout failed:', err)
  }
}
</script>