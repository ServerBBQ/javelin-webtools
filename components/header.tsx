"use client";

import { X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Header() {
  const pathname = usePathname();
  const showXButton = pathname !== "/";


  return (
    <div className="h-16">
      <div className="h-16 bg-secondary fixed top-0 left-0 px-7 pr-15 rounded-br-full flex items-center z-100">
        <Link href="/" className="font-bold text-lg hover:underline">
          Javelin 3rd party web tools
        </Link>
      </div>
      <div className="h-10 bg-secondary fixed top-0 left-0 w-full flex items-center">
          {showXButton && (
          <Link className="ml-auto hover:bg-primary/20 p-2 rounded-full" href="/">
            <X />
          </Link>
        )}
      </div>
    </div>
  );
}