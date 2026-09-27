"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AdminForm, fileFrom, filesFrom, valueFrom } from "@/components/admin/AdminForm";
import { Input, Label } from "@/components/ui";
import { api, upload } from "@/lib/api";
import type { Element } from "@/lib/types";
import { useMe } from "@/lib/useMe";

// Uploaded PNGs get a public URL first, then the record is created with that URL
async function uploadImage(file: File, kind: "element" | "avatar" | "thumbnail") {
  const form = new FormData();
  form.append("kind", kind);
  form.append("file", file);
  return (await upload<{ url: string }>("/admin/upload/image", form)).url;
}

export default function AdminPage() {
  const router = useRouter();
  const { me } = useMe();
  const [elements, setElements] = useState<Element[] | null>(null);
  // Bumped after creating furniture so the list reloads
  const [version, setVersion] = useState(0);

  const isAdmin = me?.role === "Admin";

  useEffect(() => {
    if (me && !isAdmin) router.replace("/dashboard");
  }, [me, isAdmin, router]);

  useEffect(() => {
    if (!isAdmin) return;
    api<{ elements: Element[] }>("/space/elements").then((res) => setElements(res.elements));
  }, [isAdmin, version]);

  if (!isAdmin) {
    return <main className="flex min-h-screen items-center justify-center text-copy-lighter">Loading…</main>;
  }

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 p-6">
      <header className="flex items-center justify-between">
        <div>
          <Link href="/dashboard" className="text-sm text-primary hover:underline">
            ← Dashboard
          </Link>
          <h1 className="mt-1 text-2xl font-semibold">Admin</h1>
        </div>
      </header>

      <AdminForm
        title="Furniture"
        description="A PNG sprite and its footprint in 32px tiles. Solid furniture blocks movement on its bottom row."
        submitLabel="Add furniture"
        onSubmit={async (form) => {
          const imageUrl = await uploadImage(fileFrom(form, "image"), "element");
          await api("/admin/element", {
            method: "POST",
            body: {
              imageUrl,
              width: Number(valueFrom(form, "width")),
              height: Number(valueFrom(form, "height")),
              static: (form.elements.namedItem("static") as HTMLInputElement).checked,
            },
          });
          setVersion((v) => v + 1);
          return "Furniture added. It's now in every owner's build palette.";
        }}
      >
        <label className="block">
          <Label>Image (PNG)</Label>
          <Input name="image" type="file" accept="image/png" required />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <Label>Width (tiles)</Label>
            <Input name="width" type="number" min={1} defaultValue={1} required />
          </label>
          <label className="block">
            <Label>Height (tiles)</Label>
            <Input name="height" type="number" min={1} defaultValue={1} required />
          </label>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input name="static" type="checkbox" defaultChecked className="accent-primary" />
          Solid (blocks movement)
        </label>

        <div>
          <Label>Existing furniture</Label>
          <div className="flex flex-wrap gap-2">
            {elements?.map((el) => (
              // eslint-disable-next-line @next/next/no-img-element -- pixel-art sprite served from /public
              <img
                key={el.id}
                src={el.imageUrl}
                alt=""
                title={`${el.width}×${el.height}${el.static ? ", solid" : ""}`}
                className="pixelated size-12 rounded-lg border border-border object-contain p-1"
              />
            ))}
          </div>
        </div>
      </AdminForm>

      <AdminForm
        title="Avatar"
        description="A character sprite sheet laid out like /assets/characters/adam.png (16×32 frames)."
        submitLabel="Add avatar"
        onSubmit={async (form) => {
          const imageUrl = await uploadImage(fileFrom(form, "sheet"), "avatar");
          await api("/admin/avatar", { method: "POST", body: { name: valueFrom(form, "name"), imageUrl } });
          return "Avatar added. Players can pick it from the dashboard.";
        }}
      >
        <label className="block">
          <Label>Name</Label>
          <Input name="name" required minLength={1} placeholder="Adam" />
        </label>
        <label className="block">
          <Label>Sprite sheet (PNG)</Label>
          <Input name="sheet" type="file" accept="image/png" required />
        </label>
      </AdminForm>

      <AdminForm
        title="Map"
        description="Export from Tiled as .tmj with embedded tilesets and 32px tiles, then upload every tileset image it uses. Tiles with a `collides: true` property block movement."
        submitLabel="Add map"
        onSubmit={async (form) => {
          const bundle = new FormData();
          bundle.append("map", fileFrom(form, "map"));
          for (const file of filesFrom(form, "tilesets")) bundle.append("tilesets", file);
          const { tmjUrl, width, height } = await upload<{ tmjUrl: string; width: number; height: number }>(
            "/admin/upload/map",
            bundle
          );
          const thumbnail = await uploadImage(fileFrom(form, "thumbnail"), "thumbnail");

          await api("/admin/map", {
            method: "POST",
            body: { name: valueFrom(form, "name"), thumbnail, tmjUrl, dimensions: `${width}x${height}`, defaultElements: [] },
          });
          return `Map added (${width}×${height} tiles). It's now in the create-space picker.`;
        }}
      >
        <label className="block">
          <Label>Name</Label>
          <Input name="name" required minLength={3} placeholder="Rooftop café" />
        </label>
        <label className="block">
          <Label>Map (.tmj)</Label>
          <Input name="map" type="file" accept=".tmj,.json,application/json" required />
        </label>
        <label className="block">
          <Label>Tileset images (PNG, select all)</Label>
          <Input name="tilesets" type="file" accept="image/png" multiple required />
        </label>
        <label className="block">
          <Label>Thumbnail (PNG)</Label>
          <Input name="thumbnail" type="file" accept="image/png" required />
        </label>
      </AdminForm>
    </main>
  );
}
