import { GameCanvas } from "@/components/GameCanvas";

export default function Home() {
  return (
    <div className="min-h-screen bg-black flex flex-col">
      {/* <h1 className="text-white text-center p-4">Hello</h1> */}

      <div className="flex-1 flex items-center justify-center">
        {/* Arena container */}
        <div className="w-[100vw] h-[100vh] bg-zinc-900">
          <GameCanvas />
        </div>
      </div>
    </div>
  );
}
