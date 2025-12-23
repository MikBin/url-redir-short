<template>
  <div class="min-h-screen bg-gray-100">
    <nav class="bg-white shadow mb-4 p-4 flex justify-between items-center" v-if="user">
      <div class="font-bold text-xl">Redir Admin</div>
      <div>
        <span class="mr-4 text-sm text-gray-600">{{ user.email }}</span>
        <button @click="logout" class="bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600">Logout</button>
      </div>
    </nav>
    <div class="container mx-auto p-4">
      <NuxtPage />
    </div>
  </div>
</template>

<script setup lang="ts">
const user = useSupabaseUser()
const supabase = useSupabaseClient()
const router = useRouter()

const logout = async () => {
  await supabase.auth.signOut()
  router.push('/login')
}

// Redirect to login if not authenticated
watchEffect(() => {
  if (!user.value && router.currentRoute.value.path !== '/login') {
    router.push('/login')
  }
})
</script>
