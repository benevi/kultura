// ============================================================
// KULTURA — Friends Actions (cliente)
// Helpers que hacen fetch al Route Handler /api/friends.
// Uso exclusivo en Client Components.
// ============================================================

/** Envía una solicitud de amistad al usuario con el id dado */
export async function sendFriendRequest(receiverId: string): Promise<void> {
  const response = await fetch('/api/friends', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ receiverId }),
  })

  if (!response.ok) {
    const data = await response.json().catch(() => ({})) as { error?: string }
    throw new Error(data.error ?? 'Failed to send friend request')
  }
}

/** Acepta o rechaza una solicitud de amistad */
export async function respondToFriendRequest(
  friendshipId: string,
  action: 'accept' | 'decline'
): Promise<void> {
  const response = await fetch('/api/friends', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ friendshipId, action }),
  })

  if (!response.ok) {
    const data = await response.json().catch(() => ({})) as { error?: string }
    throw new Error(data.error ?? 'Failed to respond to friend request')
  }
}

/** Elimina una amistad existente */
export async function removeFriend(friendshipId: string): Promise<void> {
  const response = await fetch('/api/friends', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ friendshipId }),
  })

  if (!response.ok) {
    const data = await response.json().catch(() => ({})) as { error?: string }
    throw new Error(data.error ?? 'Failed to remove friend')
  }
}
