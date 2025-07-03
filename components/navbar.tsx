// "use client"

// import Image from "next/image"
// import Link from "next/link"
// import { SignedIn, SignedOut, useUser, SignOutButton } from "@clerk/nextjs"
// import { useEffect, useState } from "react"

// export default function NavBar() {
//     const { isLoaded, isSignedIn, user } = useUser()
//     const [isSubscribed, setIsSubscribed] = useState(true) // Default to true to avoid flash

//     useEffect(() => {
//         // Check subscription status when user is loaded
//         if (isLoaded && isSignedIn && user?.id) {
//             fetch(`/api/check-subscription?userId=${user.id}`)
//                 .then(res => res.json())
//                 .then(data => {
//                     setIsSubscribed(!!data.subscriptionActive)
//                 })
//                 .catch(err => {
//                     console.error("Error checking subscription:", err)
//                     setIsSubscribed(false) // Assume not subscribed on error
//                 })
//         }
//     }, [isLoaded, isSignedIn, user?.id])

//     if (!isLoaded) return <p>Loading...</p>

//     return (
//         <nav className="fixed top-0 left-0 w-full bg-white shadow-sm z-50">
//             {" "}
//             <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
//                 <Link href="/">
//                     <Image className="text-xl font-bold text-emerald-700 cursor-pointer"
//                     src="/RPLogo2.png" width={60} height={60} alt="Logo"/>
//                 </Link>
//             <div className="space-x-6 flex items-center">
//                 {" "}
//                 <SignedIn>
//                     <Link 
//                         href='/rp'
//                         className="text-gray-700 hover:text-emerald-500 transition-colors">
//                         RP
//                     </Link>
//                     <Link 
//                         href='/stack'
//                         className="text-gray-700 hover:text-emerald-500 transition-colors">
//                         Stack
//                     </Link>
//                     <Link 
//                         href='/datalab'
//                         className="text-gray-700 hover:text-emerald-500 transition-colors">
//                         DataLab
//                     </Link>
//                     <Link 
//                         href='/gamelab'
//                         className="text-gray-700 hover:text-emerald-500 transition-colors">
//                         GameLab
//                     </Link>
//                     <Link 
//                         href='/collect'
//                         className="text-gray-700 hover:text-emerald-500 transition-colors">
//                         Collect
//                     </Link>
                    
//                     {user?.imageUrl ? (
//                         <Link href="/profile">
//                             {" "}
//                             <Image 
//                                 src={user.imageUrl}
//                                 alt="Profile Picture"
//                                 width={40}
//                                 height={40}
//                                 className="rounded-full"
//                             />{" "}
//                         </Link>
//                     ) : (
//                         <div className="w-10 h-10 bg-gray-300 rounded-full"></div>
//                     )}
//                     {/* Add Subscribe button for unsubscribed users */}
//                     {!isSubscribed && (
//                         <Link 
//                             href='/subscribe'
//                             className="px-4 py-2 bg-emerald-500 text-white rounded hover:bg-emerald-600 transition-colors">
//                             Subscribe
//                         </Link>
//                     )}
//                     <SignOutButton>
//                         <button className="ml-4 px-4 py-2 bg-emerald-500 text-white rounded hover:bg-emerald-600 transition">Sign Out</button>
//                     </SignOutButton>
//                 </SignedIn>
                
//                 <SignedOut>
//                     <Link
//                         href="/sign-up"
//                         className="px-4 py-2 bg-emerald-500 text-white rounded hover:bg-emerald-600 transition"
//                     >
//                         Sign Up
//                     </Link>
//                 </SignedOut>
//             </div>
//             </div> 
//         </nav>
//     ) 
// }




"use client"

import Image from "next/image"
import Link from "next/link"
import { SignedIn, SignedOut, useUser, SignOutButton } from "@clerk/nextjs"
import { useEffect, useState } from "react"

export default function NavBar() {
    const { isLoaded, isSignedIn, user } = useUser()
    const [isSubscribed, setIsSubscribed] = useState(true) // Default to true to avoid flash
    const [isClient, setIsClient] = useState(false)

    useEffect(() => {
        // This effect runs only on the client, after initial render
        setIsClient(true)
    }, [])

    useEffect(() => {
        // Check subscription status when user is loaded
        if (isLoaded && isSignedIn && user?.id) {
            fetch(`/api/check-subscription?userId=${user.id}`)
                .then(res => res.json())
                .then(data => {
                    setIsSubscribed(!!data.subscriptionActive)
                })
                .catch(err => {
                    console.error("Error checking subscription:", err)
                    setIsSubscribed(false) // Assume not subscribed on error
                })
        }
    }, [isLoaded, isSignedIn, user?.id])

    // On the server or during initial client hydration, render a skeleton UI
    // to prevent mismatch.
    if (!isClient || !isLoaded) {
        return (
            <nav className="fixed top-0 left-0 w-full bg-white shadow-sm z-50">
                <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
                     <Link href="/">
                        <Image className="text-xl font-bold text-emerald-700 cursor-pointer"
                        src="/RPLogo2.png" width={60} height={60} alt="Logo"/>
                    </Link>
                    <div className="h-10 w-24 bg-gray-200 rounded animate-pulse"></div>
                </div>
            </nav>
        )
    }

    // After hydration, render the actual content
    return (
        <nav className="fixed top-0 left-0 w-full bg-white shadow-sm z-50">
            {" "}
            <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
                <Link href="/">
                    <Image className="text-xl font-bold text-emerald-700 cursor-pointer"
                    src="/RPLogo2.png" width={60} height={60} alt="Logo"/>
                </Link>
            <div className="space-x-6 flex items-center">
                {" "}
                <SignedIn>
                    <Link 
                        href='/rp'
                        className="text-gray-700 hover:text-emerald-500 transition-colors">
                        RP
                    </Link>
                    <Link 
                        href='/stack'
                        className="text-gray-700 hover:text-emerald-500 transition-colors">
                        Stack
                    </Link>
                    <Link 
                        href='/datalab'
                        className="text-gray-700 hover:text-emerald-500 transition-colors">
                        DataLab
                    </Link>
                    <Link 
                        href='/gamelab'
                        className="text-gray-700 hover:text-emerald-500 transition-colors">
                        GameLab
                    </Link>
                    <Link 
                        href='/collect'
                        className="text-gray-700 hover:text-emerald-500 transition-colors">
                        Collect
                    </Link>
                    
                    {user?.imageUrl ? (
                        <Link href="/profile">
                            {" "}
                            <Image 
                                src={user.imageUrl}
                                alt="Profile Picture"
                                width={40}
                                height={40}
                                className="rounded-full"
                            />{" "}
                        </Link>
                    ) : (
                        <div className="w-10 h-10 bg-gray-300 rounded-full"></div>
                    )}
                    {/* Add Subscribe button for unsubscribed users */}
                    {!isSubscribed && (
                        <Link 
                            href='/subscribe'
                            className="px-4 py-2 bg-emerald-500 text-white rounded hover:bg-emerald-600 transition-colors">
                            Subscribe
                        </Link>
                    )}
                    <SignOutButton>
                        <button className="ml-4 px-4 py-2 bg-emerald-500 text-white rounded hover:bg-emerald-600 transition">Sign Out</button>
                    </SignOutButton>
                </SignedIn>
                
                <SignedOut>
                    <Link
                        href="/sign-up"
                        className="px-4 py-2 bg-emerald-500 text-white rounded hover:bg-emerald-600 transition"
                    >
                        Sign Up
                    </Link>
                </SignedOut>
            </div>
            </div> 
        </nav>
    ) 
}