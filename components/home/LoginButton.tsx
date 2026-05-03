"use client"

import { signIn, signOut, useSession } from "next-auth/react"

export default function LoginButton() {
  const { data: session } = useSession()

  if (session) {
    return (
      <div>
        <span>{session.user.name}</span>
        <button onClick={() => signOut()}>Logout</button>
      </div>
    )
  }

  return (
    <button onClick={() => signIn("discord")}>
      Login with Discord
    </button>
  )
}