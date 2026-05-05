// scripts/seed-test.mjs
// Idempotent seed for kultura-test Supabase project.
// Run: node --env-file=.env.local scripts/seed-test.mjs
import { createClient } from '@supabase/supabase-js'

const url = process.env.SUPABASE_TEST_URL
const serviceKey = process.env.SUPABASE_TEST_SERVICE_ROLE_KEY
const userAEmail = process.env.TEST_USER_EMAIL
const userAPassword = process.env.TEST_USER_PASSWORD
const userBEmail = process.env.TEST_USER_B_EMAIL

// Guard: refuse to touch production
if (!url || url.includes('zfrbyphzvfuvejdwjfea')) {
  console.error('REFUSED: SUPABASE_TEST_URL apunta a producción o falta')
  process.exit(1)
}

if (!serviceKey || !userAEmail || !userAPassword || !userBEmail) {
  console.error('REFUSED: faltan env vars requeridas (SUPABASE_TEST_SERVICE_ROLE_KEY, TEST_USER_EMAIL, TEST_USER_PASSWORD, TEST_USER_B_EMAIL)')
  process.exit(1)
}

console.log(`Conectando a: ${url}`)

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
})

// ─── helpers ────────────────────────────────────────────────────────────────

function log(status, entity, detail) {
  console.log(`  [${status}] ${entity}${detail ? ' — ' + detail : ''}`)
}

async function findOrCreateUser(email, password) {
  const { data: listData, error: listErr } = await admin.auth.admin.listUsers()
  if (listErr) throw new Error(`listUsers failed: ${listErr.message}`)

  const existing = listData.users.find(u => u.email === email)
  if (existing) {
    log('found', 'auth.user', email)
    return existing.id
  }

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })
  if (error) throw new Error(`createUser(${email}) failed: ${error.message}`)
  log('created', 'auth.user', email)
  return data.user.id
}

async function waitForPublicUser(userId) {
  // Trigger handle_new_user fires async — retry up to 3s
  for (let i = 0; i < 6; i++) {
    const { data } = await admin.from('users').select('id').eq('id', userId).maybeSingle()
    if (data) return
    await new Promise(r => setTimeout(r, 500))
  }
  throw new Error(`public.users row never created for ${userId} — trigger failed?`)
}

async function findOrCreateFriendship(requesterId, receiverId) {
  const { data: existing } = await admin
    .from('friendships')
    .select('id')
    .eq('requester_id', requesterId)
    .eq('receiver_id', receiverId)
    .maybeSingle()

  if (existing) {
    log('found', 'friendship', `${requesterId.slice(0,8)}↔${receiverId.slice(0,8)}`)
    return existing.id
  }

  const { data, error } = await admin
    .from('friendships')
    .insert({ requester_id: requesterId, receiver_id: receiverId, status: 'accepted' })
    .select('id')
    .single()
  if (error) throw new Error(`insert friendship failed: ${error.message}`)
  log('created', 'friendship', `status=accepted`)
  return data.id
}

async function findOrCreateGroup(ownerId, name) {
  const { data: existing } = await admin
    .from('groups')
    .select('id')
    .eq('owner_id', ownerId)
    .eq('name', name)
    .maybeSingle()

  if (existing) {
    log('found', 'group', name)
    return existing.id
  }

  const { data, error } = await admin
    .from('groups')
    .insert({ owner_id: ownerId, name, description: 'Grupo de test E2E', cover_color: '#E82020' })
    .select('id')
    .single()
  if (error) throw new Error(`insert group failed: ${error.message}`)
  log('created', 'group', name)
  return data.id
}

async function ensureGroupMember(groupId, userId, role) {
  const { data: existing } = await admin
    .from('group_members')
    .select('user_id')
    .eq('group_id', groupId)
    .eq('user_id', userId)
    .maybeSingle()

  if (existing) {
    log('found', 'group_member', `${userId.slice(0,8)} role=${role}`)
    return
  }

  const { error } = await admin
    .from('group_members')
    .upsert({ group_id: groupId, user_id: userId, role }, { onConflict: 'group_id,user_id' })
  if (error) throw new Error(`upsert group_member failed: ${error.message}`)
  log('created', 'group_member', `role=${role}`)
}

async function findOrCreateGroupPost(groupId, userId) {
  const { data: existing } = await admin
    .from('group_posts')
    .select('id')
    .eq('group_id', groupId)
    .eq('user_id', userId)
    .maybeSingle()

  if (existing) {
    log('found', 'group_post', existing.id.slice(0,8))
    return existing.id
  }

  const { data, error } = await admin
    .from('group_posts')
    .insert({ group_id: groupId, user_id: userId, content: 'Post de test E2E', media_id: null })
    .select('id')
    .single()
  if (error) throw new Error(`insert group_post failed: ${error.message}`)
  log('created', 'group_post', data.id.slice(0,8))
  return data.id
}

async function findOrCreateConversation(userAId, userBId) {
  // Find conversation that has exactly both users as members
  const { data: membershipsA } = await admin
    .from('conversation_members')
    .select('conversation_id')
    .eq('user_id', userAId)

  if (membershipsA && membershipsA.length > 0) {
    const convIds = membershipsA.map(m => m.conversation_id)
    const { data: membershipsB } = await admin
      .from('conversation_members')
      .select('conversation_id')
      .eq('user_id', userBId)
      .in('conversation_id', convIds)

    if (membershipsB && membershipsB.length > 0) {
      const convId = membershipsB[0].conversation_id
      log('found', 'conversation', convId.slice(0,8))
      return convId
    }
  }

  const { data: conv, error: convErr } = await admin
    .from('conversations')
    .insert({})
    .select('id')
    .single()
  if (convErr) throw new Error(`insert conversation failed: ${convErr.message}`)

  const { error: membErr } = await admin
    .from('conversation_members')
    .insert([
      { conversation_id: conv.id, user_id: userAId },
      { conversation_id: conv.id, user_id: userBId },
    ])
  if (membErr) throw new Error(`insert conversation_members failed: ${membErr.message}`)

  log('created', 'conversation', conv.id.slice(0,8))
  return conv.id
}

async function findOrCreateMessage(conversationId, senderId) {
  const { data: existing } = await admin
    .from('messages')
    .select('id')
    .eq('conversation_id', conversationId)
    .eq('sender_id', senderId)
    .maybeSingle()

  if (existing) {
    log('found', 'message', existing.id.slice(0,8))
    return existing.id
  }

  const { data, error } = await admin
    .from('messages')
    .insert({ conversation_id: conversationId, sender_id: senderId, content: 'Mensaje de test E2E' })
    .select('id')
    .single()
  if (error) throw new Error(`insert message failed: ${error.message}`)
  log('created', 'message', data.id.slice(0,8))
  return data.id
}

async function findOrCreateNotification(userId, fromUsername) {
  const { data: existing } = await admin
    .from('notifications')
    .select('id')
    .eq('user_id', userId)
    .eq('type', 'recommendation')
    .maybeSingle()

  if (existing) {
    log('found', 'notification', existing.id.slice(0,8))
    return existing.id
  }

  const payload = {
    fromUsername,
    mediaTitle: 'Película de test',
    mediaId: 'movie_550',
    message: 'Te la recomiendo',
  }

  const { data, error } = await admin
    .from('notifications')
    .insert({ user_id: userId, type: 'recommendation', payload })
    .select('id')
    .single()
  if (error) throw new Error(`insert notification failed: ${error.message}`)
  log('created', 'notification', data.id.slice(0,8))
  return data.id
}

// ─── main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n=== seed-test.mjs ===\n')

  // 1. Users
  const userAId = await findOrCreateUser(userAEmail, userAPassword)
  await waitForPublicUser(userAId)

  const userBId = await findOrCreateUser(userBEmail, userAPassword)
  await waitForPublicUser(userBId)

  // Get username of B for notification payload
  const { data: userBRow } = await admin.from('users').select('username').eq('id', userBId).single()
  const userBUsername = userBRow?.username ?? 'test-user-b'

  // 2. Friendship A↔B
  await findOrCreateFriendship(userAId, userBId)

  // 3. Group owned by A
  const groupId = await findOrCreateGroup(userAId, 'Test Group')

  // trigger handle_new_group already inserts A as owner — ensure B as member
  await ensureGroupMember(groupId, userAId, 'owner')
  await ensureGroupMember(groupId, userBId, 'member')

  // 4. Group post by A
  await findOrCreateGroupPost(groupId, userAId)

  // 5. Conversation A↔B + message
  const convId = await findOrCreateConversation(userAId, userBId)
  await findOrCreateMessage(convId, userAId)

  // 6. Notification for A (recommendation from B)
  await findOrCreateNotification(userAId, userBUsername)

  // ─── summary ───────────────────────────────────────────────────────────────
  const result = {
    userAId,
    userBId,
    groupId,
    conversationId: convId,
  }

  console.log('\n=== RESULTADO ===')
  console.log(JSON.stringify(result, null, 2))
  console.log('\n>>> Copia groupId a .env.local como TEST_GROUP_ID=' + groupId)
  console.log('=================\n')
}

main().catch(err => {
  console.error('\nSEED FAILED:', err.message)
  process.exit(1)
})
