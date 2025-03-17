import Image from "next/image"
import Link from "next/link"

export default function NavBar() {

    return (
    <nav>
        {" "}
        <div>
            <Link href = "/">
                <Image src = "/logo.png" width = {60} height = {60} alt = "Logo"/>
            </Link>
        </div>
        <div></div>
    </nav>
    ) 
}