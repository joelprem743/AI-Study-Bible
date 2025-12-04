import ProfileMenu from "./ProfileMenu";

export function Header() {
  return (
    <header className="flex items-center justify-between px-4 py-2 border-b border-slate-700">
      <div className="text-sm font-semibold">
        AI Bible Study Companion
      </div>

      {/* This will sit on the first line, top-right */}
      <ProfileMenu />
    </header>
  );
}
