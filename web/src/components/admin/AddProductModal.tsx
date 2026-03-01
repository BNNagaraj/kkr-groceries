"use client";

import React, { useState, useRef } from "react";
import { doc, setDoc } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "@/lib/firebase";
import { Product } from "@/contexts/AppContext";
import { PRODUCT_CATEGORIES, UNIT_OPTIONS } from "@/lib/constants";
import { toast } from "sonner";
import Image from "next/image";
import { Upload, Loader2 } from "lucide-react";

import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface Props {
    open: boolean;
    onClose: () => void;
    existingIds: number[];
    onProductAdded: (product: Product) => void;
}

export default function AddProductModal({ open, onClose, existingIds, onProductAdded }: Props) {
    const [name, setName] = useState("");
    const [telugu, setTelugu] = useState("");
    const [hindi, setHindi] = useState("");
    const [price, setPrice] = useState<number>(0);
    const [unit, setUnit] = useState("Kg");
    const [moq, setMoq] = useState<number>(1);
    const [category, setCategory] = useState("");
    const [saving, setSaving] = useState(false);
    const [imageUrl, setImageUrl] = useState("");
    const [uploading, setUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const nextId = existingIds.length > 0 ? Math.max(...existingIds) + 1 : 1;

    const resetForm = () => {
        setName("");
        setTelugu("");
        setHindi("");
        setPrice(0);
        setUnit("Kg");
        setMoq(1);
        setCategory("");
        setImageUrl("");
    };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!file.type.startsWith("image/") || file.size > 10 * 1024 * 1024) {
            toast.error("Invalid image. Must be an image under 10MB.");
            return;
        }

        setUploading(true);
        try {
            const base64 = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result as string);
                reader.onerror = reject;
                reader.readAsDataURL(file);
            });

            const uploadFn = httpsCallable<
                { productId: string; base64Image: string },
                { success: boolean; url: string }
            >(functions, "uploadProductImage");
            const result = await uploadFn({ productId: nextId.toString(), base64Image: base64 });
            if (result.data.success && result.data.url) {
                setImageUrl(result.data.url);
                toast.success("Image uploaded!");
            }
        } catch (err) {
            console.error("Image upload failed:", err);
            toast.error("Image upload failed.");
        } finally {
            setUploading(false);
        }
    };

    const handleSave = async () => {
        if (!name.trim()) { toast.error("Product name is required."); return; }
        if (price <= 0) { toast.error("Price must be greater than 0."); return; }
        if (!category) { toast.error("Please select a category."); return; }

        setSaving(true);
        try {
            const newProduct: Product = {
                id: nextId,
                name: name.trim(),
                telugu: telugu.trim(),
                hindi: hindi.trim(),
                price,
                unit,
                moq,
                category,
                image: imageUrl,
                isHidden: false,
                moqRequired: true,
            };
            await setDoc(doc(db, "products", nextId.toString()), newProduct);
            toast.success(`Product "${name}" added successfully!`);
            onProductAdded(newProduct);
            resetForm();
            onClose();
        } catch (err) {
            console.error("Failed to add product:", err);
            toast.error("Failed to add product.");
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
            <DialogContent className="sm:max-w-[520px]">
                <DialogHeader>
                    <DialogTitle>Add New Product</DialogTitle>
                    <DialogDescription>
                        Fill in the product details. Telugu text can be pasted directly.
                    </DialogDescription>
                </DialogHeader>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                    {/* Product Name */}
                    <div className="sm:col-span-2">
                        <label className="text-sm font-medium text-slate-600 mb-1 block">
                            Product Name (English) <span className="text-red-500">*</span>
                        </label>
                        <Input
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="e.g. Tomato"
                        />
                    </div>

                    {/* Telugu Name */}
                    <div>
                        <label className="text-sm font-medium text-slate-600 mb-1 block">
                            Telugu Name (తెలుగు)
                        </label>
                        <Input
                            value={telugu}
                            onChange={(e) => setTelugu(e.target.value)}
                            placeholder="e.g. టమాటో"
                            className="font-telugu"
                        />
                    </div>

                    {/* Hindi Pronunciation */}
                    <div>
                        <label className="text-sm font-medium text-slate-600 mb-1 block">
                            Hindi Pronunciation (English)
                        </label>
                        <Input
                            value={hindi}
                            onChange={(e) => setHindi(e.target.value)}
                            placeholder="e.g. Tamatar"
                        />
                    </div>

                    {/* Price */}
                    <div>
                        <label className="text-sm font-medium text-slate-600 mb-1 block">
                            Price (₹) <span className="text-red-500">*</span>
                        </label>
                        <Input
                            type="number"
                            value={price || ""}
                            onChange={(e) => setPrice(Number(e.target.value))}
                            min={0}
                            placeholder="0"
                        />
                    </div>

                    {/* Unit */}
                    <div>
                        <label className="text-sm font-medium text-slate-600 mb-1 block">
                            Unit
                        </label>
                        <select
                            value={unit}
                            onChange={(e) => setUnit(e.target.value)}
                            className="w-full h-10 px-3 border border-slate-200 rounded-md text-sm bg-white focus:ring-1 focus:ring-emerald-500 outline-none"
                        >
                            {UNIT_OPTIONS.map((u) => (
                                <option key={u} value={u}>{u}</option>
                            ))}
                        </select>
                    </div>

                    {/* MOQ */}
                    <div>
                        <label className="text-sm font-medium text-slate-600 mb-1 block">
                            Min Order Qty (MOQ)
                        </label>
                        <Input
                            type="number"
                            value={moq}
                            onChange={(e) => setMoq(Number(e.target.value) || 1)}
                            min={1}
                        />
                    </div>

                    {/* Category */}
                    <div>
                        <label className="text-sm font-medium text-slate-600 mb-1 block">
                            Category <span className="text-red-500">*</span>
                        </label>
                        <select
                            value={category}
                            onChange={(e) => setCategory(e.target.value)}
                            className="w-full h-10 px-3 border border-slate-200 rounded-md text-sm bg-white focus:ring-1 focus:ring-emerald-500 outline-none"
                        >
                            <option value="">Select category...</option>
                            {PRODUCT_CATEGORIES.map((c) => (
                                <option key={c.id} value={c.id}>{c.label}</option>
                            ))}
                        </select>
                    </div>

                    {/* Image Upload */}
                    <div className="sm:col-span-2">
                        <label className="text-sm font-medium text-slate-600 mb-1 block">
                            Product Image
                        </label>
                        <div className="flex items-center gap-4">
                            <div className="w-16 h-16 rounded-xl border border-slate-200 bg-slate-50 overflow-hidden relative flex items-center justify-center shrink-0">
                                {imageUrl ? (
                                    <Image
                                        src={imageUrl}
                                        alt="Preview"
                                        fill
                                        className="object-cover"
                                        unoptimized={!imageUrl.includes("googleapis.com")}
                                    />
                                ) : (
                                    <span className="text-2xl text-slate-300">{name ? name[0] : "?"}</span>
                                )}
                            </div>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => fileInputRef.current?.click()}
                                disabled={uploading}
                            >
                                {uploading ? (
                                    <><Loader2 className="w-4 h-4 animate-spin" /> Uploading...</>
                                ) : (
                                    <><Upload className="w-4 h-4" /> Upload Image</>
                                )}
                            </Button>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={handleImageUpload}
                            />
                        </div>
                    </div>
                </div>

                <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
                    <Button variant="outline" onClick={onClose} disabled={saving}>
                        Cancel
                    </Button>
                    <Button onClick={handleSave} disabled={saving}>
                        {saving ? "Adding..." : "Add Product"}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
