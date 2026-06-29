"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { db, functions } from "@/lib/firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { toast } from "sonner";
import {
  Save, Loader2, ImagePlus, Trash2, Sparkles, Eye, Check,
  Pencil, RefreshCw, ExternalLink, Search, LayoutGrid,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  OG_TEMPLATES,
  DEFAULT_OG_CONTENT,
  type OgTemplate,
  type OgBannerContent,
  type OgBannerSettings,
} from "@/lib/og-templates";

const CATEGORIES = ["All", "Professional", "Bold", "Minimal", "Creative", "Classic"] as const;

export default function OgBannerSection() {
  const [settings, setSettings] = useState<OgBannerSettings>({
    activeTemplateId: "gradient-orange",
    content: { ...DEFAULT_OG_CONTENT },
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<string>("gradient-orange");
  const [categoryFilter, setCategoryFilter] = useState<string>("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [showContentEditor, setShowContentEditor] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

  // Load saved settings from Firestore
  useEffect(() => {
    (async () => {
      try {
        const snap = await getDoc(doc(db, "settings", "ogBanner"));
        if (snap.exists()) {
          const data = snap.data() as OgBannerSettings;
          setSettings({
            activeTemplateId: data.activeTemplateId || "gradient-orange",
            content: { ...DEFAULT_OG_CONTENT, ...data.content },
            customLogoUrl: data.customLogoUrl,
            generatedImageUrl: data.generatedImageUrl,
            lastGeneratedAt: data.lastGeneratedAt,
          });
          setSelectedTemplate(data.activeTemplateId || "gradient-orange");
        }
      } catch (e) {
        console.error("[OgBanner] Load failed:", e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Save settings to Firestore
  const saveSettings = useCallback(async () => {
    setSaving(true);
    try {
      const toSave = {
        ...settings,
        activeTemplateId: selectedTemplate,
      };
      await setDoc(doc(db, "settings", "ogBanner"), toSave, { merge: true });
      setSettings(toSave);
      toast.success("OG Banner settings saved!");
    } catch (e) {
      console.error("[OgBanner] Save failed:", e);
      toast.error("Failed to save settings.");
    } finally {
      setSaving(false);
    }
  }, [settings, selectedTemplate]);

  // Generate OG image via Cloud Function
  const generateBanner = useCallback(async () => {
    setGenerating(true);
    try {
      // Save settings first
      const toSave: OgBannerSettings = {
        ...settings,
        activeTemplateId: selectedTemplate,
      };
      await setDoc(doc(db, "settings", "ogBanner"), toSave, { merge: true });

      // Call Cloud Function to generate the image
      const generateFn = httpsCallable<
        { templateId: string; content: OgBannerContent; customLogoUrl?: string },
        { success: boolean; imageUrl: string; message?: string }
      >(functions, "generateOgBanner");

      const result = await generateFn({
        templateId: selectedTemplate,
        content: settings.content,
        customLogoUrl: settings.customLogoUrl,
      });

      if (result.data.success) {
        setSettings((prev) => ({
          ...prev,
          activeTemplateId: selectedTemplate,
          generatedImageUrl: result.data.imageUrl,
          lastGeneratedAt: new Date().toISOString(),
        }));
        // Save the generated URL back
        await setDoc(doc(db, "settings", "ogBanner"), {
          generatedImageUrl: result.data.imageUrl,
          lastGeneratedAt: new Date().toISOString(),
          activeTemplateId: selectedTemplate,
        }, { merge: true });
        toast.success("OG Banner generated and published!");
      } else {
        toast.error(result.data.message || "Generation failed");
      }
    } catch (e: any) {
      console.error("[OgBanner] Generate failed:", e);
      toast.error(e?.message || "Failed to generate banner. Make sure the Cloud Function is deployed.");
    } finally {
      setGenerating(false);
    }
  }, [settings, selectedTemplate]);

  // Upload custom logo for OG banner
  const onLogoSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Logo must be under 2 MB.");
      return;
    }
    setUploadingLogo(true);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const uploadFn = httpsCallable<
        { base64Image: string },
        { success: boolean; url: string }
      >(functions, "uploadLogoImage");
      const result = await uploadFn({ base64Image: base64 });
      if (result.data.success && result.data.url) {
        setSettings((prev) => ({ ...prev, customLogoUrl: result.data.url }));
        toast.success("Logo uploaded for OG banner!");
      }
    } catch (err) {
      console.error("Logo upload failed:", err);
      toast.error("Logo upload failed.");
    } finally {
      setUploadingLogo(false);
      if (logoInputRef.current) logoInputRef.current.value = "";
    }
  };

  const removeLogo = () => {
    setSettings((prev) => ({ ...prev, customLogoUrl: undefined }));
    toast.success("Custom logo removed. Default logo will be used.");
  };

  const updateContent = (field: keyof OgBannerContent, value: string) => {
    setSettings((prev) => ({
      ...prev,
      content: { ...prev.content, [field]: value },
    }));
  };

  const resetContent = () => {
    setSettings((prev) => ({ ...prev, content: { ...DEFAULT_OG_CONTENT } }));
    toast.success("Content reset to defaults.");
  };

  // Filter templates
  const filteredTemplates = OG_TEMPLATES.filter((t) => {
    const matchesCategory = categoryFilter === "All" || t.category === categoryFilter;
    const matchesSearch =
      !searchQuery ||
      t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const activeTemplate = OG_TEMPLATES.find((t) => t.id === settings.activeTemplateId);
  const selectedTemplateObj = OG_TEMPLATES.find((t) => t.id === selectedTemplate);

  if (loading) {
    return (
      <div className="text-center py-20 bg-white rounded-2xl border border-slate-100">
        <Loader2 className="w-6 h-6 animate-spin mx-auto text-slate-400" />
        <p className="text-slate-400 mt-2">Loading OG Banner settings...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-100 to-amber-100 flex items-center justify-center">
              <ImagePlus className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800">OG Banner Manager</h3>
              <p className="text-sm text-slate-500">
                Social media link preview image for WhatsApp, Facebook, Twitter
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={saveSettings}
              disabled={saving}
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save
            </Button>
            <Button
              size="sm"
              onClick={generateBanner}
              disabled={generating}
              className="bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white"
            >
              {generating ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
              {generating ? "Generating..." : "Generate & Publish"}
            </Button>
          </div>
        </div>

        {/* Current Banner Preview */}
        {settings.generatedImageUrl && (
          <div className="mt-4">
            <div className="flex items-center gap-2 mb-2">
              <Eye className="w-4 h-4 text-slate-400" />
              <span className="text-sm font-medium text-slate-600">Current Live Banner</span>
              {activeTemplate && (
                <span className="text-xs bg-orange-50 text-orange-700 px-2 py-0.5 rounded-full font-medium">
                  {activeTemplate.name}
                </span>
              )}
              {settings.lastGeneratedAt && (
                <span className="text-xs text-slate-400">
                  Generated {new Date(settings.lastGeneratedAt).toLocaleDateString("en-IN", {
                    day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
                  })}
                </span>
              )}
            </div>
            <div className="rounded-xl overflow-hidden border border-slate-200 shadow-sm">
              <img
                src={settings.generatedImageUrl}
                alt="Current OG Banner"
                className="w-full h-auto"
                style={{ aspectRatio: "1200/630" }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Template Gallery */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <LayoutGrid className="w-5 h-5 text-slate-400" />
            <h4 className="font-bold text-slate-800">Choose Template</h4>
            <span className="text-xs text-slate-400">({OG_TEMPLATES.length} designs)</span>
          </div>
        </div>

        {/* Category Filter + Search */}
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <div className="flex gap-1.5 flex-wrap">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setCategoryFilter(cat)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                  categoryFilter === cat
                    ? "bg-orange-50 border-orange-200 text-orange-700"
                    : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search templates..."
              className="w-full pl-9 pr-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-200 focus:border-orange-300"
            />
          </div>
        </div>

        {/* Template Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {filteredTemplates.map((template) => {
            const isSelected = selectedTemplate === template.id;
            const isActive = settings.activeTemplateId === template.id;
            return (
              <button
                key={template.id}
                onClick={() => setSelectedTemplate(template.id)}
                className={`group relative rounded-xl overflow-hidden border-2 transition-all duration-200 ${
                  isSelected
                    ? "border-orange-500 ring-2 ring-orange-200 shadow-lg scale-[1.02]"
                    : "border-slate-200 hover:border-orange-300 hover:shadow-md"
                }`}
              >
                {/* Thumbnail */}
                <div className="aspect-[1200/630] bg-slate-100 relative">
                  <img
                    src={template.thumbnail}
                    alt={template.name}
                    className="w-full h-full object-cover"
                    loading="lazy"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = "none";
                    }}
                  />
                  {/* Active badge */}
                  {isActive && (
                    <div className="absolute top-1.5 right-1.5 bg-green-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                      <Check className="w-2.5 h-2.5" /> LIVE
                    </div>
                  )}
                  {/* Selected overlay */}
                  {isSelected && (
                    <div className="absolute inset-0 bg-orange-500/10 flex items-center justify-center">
                      <div className="w-8 h-8 rounded-full bg-orange-500 text-white flex items-center justify-center shadow-lg">
                        <Check className="w-5 h-5" />
                      </div>
                    </div>
                  )}
                </div>
                {/* Label */}
                <div className="p-2 bg-white">
                  <p className="text-xs font-semibold text-slate-700 truncate">{template.name}</p>
                  <p className="text-[10px] text-slate-400 truncate">{template.description}</p>
                </div>
              </button>
            );
          })}
        </div>

        {filteredTemplates.length === 0 && (
          <div className="text-center py-8 text-slate-400">
            <Search className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p className="text-sm">No templates match your search.</p>
          </div>
        )}

        {/* Selected template info */}
        {selectedTemplateObj && (
          <div className="mt-4 p-3 bg-orange-50/50 rounded-xl border border-orange-100 flex items-center justify-between">
            <div>
              <span className="text-sm font-medium text-orange-800">Selected: </span>
              <span className="text-sm text-orange-700">{selectedTemplateObj.name}</span>
              <span className="text-xs text-orange-500 ml-2">— {selectedTemplateObj.description}</span>
            </div>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
              selectedTemplateObj.category === "Professional" ? "bg-blue-50 text-blue-600" :
              selectedTemplateObj.category === "Bold" ? "bg-red-50 text-red-600" :
              selectedTemplateObj.category === "Minimal" ? "bg-slate-100 text-slate-600" :
              selectedTemplateObj.category === "Creative" ? "bg-purple-50 text-purple-600" :
              "bg-green-50 text-green-600"
            }`}>
              {selectedTemplateObj.category}
            </span>
          </div>
        )}
      </div>

      {/* Content Editor */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <button
          onClick={() => setShowContentEditor(!showContentEditor)}
          className="w-full p-6 flex items-center justify-between hover:bg-slate-50/50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
              <Pencil className="w-5 h-5 text-blue-600" />
            </div>
            <div className="text-left">
              <h4 className="font-bold text-slate-800">Customize Content</h4>
              <p className="text-sm text-slate-500">Edit title, description, CTA and more</p>
            </div>
          </div>
          <svg className={`w-5 h-5 text-slate-400 transition-transform ${showContentEditor ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {showContentEditor && (
          <div className="px-6 pb-6 border-t border-slate-100 pt-4 space-y-4">
            <div className="flex items-center justify-end">
              <Button variant="ghost" size="sm" onClick={resetContent} className="text-slate-400 hover:text-slate-600">
                <RefreshCw className="w-3.5 h-3.5" /> Reset to Defaults
              </Button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-slate-600 mb-1 block">Title</label>
                <Input
                  value={settings.content.title}
                  onChange={(e) => updateContent("title", e.target.value)}
                  placeholder="KKR Groceries"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-600 mb-1 block">Subtitle</label>
                <Input
                  value={settings.content.subtitle}
                  onChange={(e) => updateContent("subtitle", e.target.value)}
                  placeholder="B2B & B2C WHOLESALE VEGETABLES"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="text-sm font-medium text-slate-600 mb-1 block">Description</label>
                <Input
                  value={settings.content.description}
                  onChange={(e) => updateContent("description", e.target.value)}
                  placeholder="Fresh vegetables at APMC wholesale prices..."
                />
                <p className="text-xs text-slate-400 mt-1">
                  Long descriptions are automatically split across multiple lines.
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-600 mb-1 block">Location</label>
                <Input
                  value={settings.content.location}
                  onChange={(e) => updateContent("location", e.target.value)}
                  placeholder="Hyderabad, Telangana"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-600 mb-1 block">Delivery Tag</label>
                <Input
                  value={settings.content.delivery}
                  onChange={(e) => updateContent("delivery", e.target.value)}
                  placeholder="Same-day Delivery"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-600 mb-1 block">CTA Text</label>
                <Input
                  value={settings.content.cta}
                  onChange={(e) => updateContent("cta", e.target.value)}
                  placeholder="Order Now"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-600 mb-1 block">CTA URL</label>
                <Input
                  value={settings.content.ctaUrl}
                  onChange={(e) => updateContent("ctaUrl", e.target.value)}
                  placeholder="kkr-groceries-02.web.app"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Custom Logo for Banner */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center">
            <ImagePlus className="w-5 h-5 text-purple-600" />
          </div>
          <div>
            <h4 className="font-bold text-slate-800">Banner Logo</h4>
            <p className="text-sm text-slate-500">
              Upload a custom logo for the banner, or use the default store logo
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="w-20 h-20 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 flex items-center justify-center overflow-hidden shrink-0">
            {settings.customLogoUrl ? (
              <img
                src={settings.customLogoUrl}
                alt="Custom Logo"
                className="w-full h-full object-contain rounded-lg"
              />
            ) : (
              <img
                src="/logo-white.png"
                alt="Default Logo"
                className="w-full h-full object-contain rounded-lg opacity-50"
              />
            )}
          </div>
          <div className="flex flex-col gap-2">
            <input
              ref={logoInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={onLogoSelected}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => logoInputRef.current?.click()}
              disabled={uploadingLogo}
            >
              {uploadingLogo ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Uploading...</>
              ) : (
                <><ImagePlus className="w-4 h-4" /> {settings.customLogoUrl ? "Change Logo" : "Upload Logo"}</>
              )}
            </Button>
            {settings.customLogoUrl && (
              <Button
                variant="ghost"
                size="sm"
                className="text-red-500 hover:text-red-700 hover:bg-red-50 justify-start"
                onClick={removeLogo}
              >
                <Trash2 className="w-4 h-4" /> Remove Custom Logo
              </Button>
            )}
            <p className="text-xs text-slate-400">
              PNG with transparent bg works best. Max 2 MB. Square ratio recommended.
            </p>
          </div>
        </div>
      </div>

      {/* How It Works Info */}
      <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-2xl border border-orange-100 p-5">
        <h4 className="font-semibold text-orange-800 text-sm mb-2 flex items-center gap-2">
          <ExternalLink className="w-4 h-4" /> How OG Banners Work
        </h4>
        <ul className="text-xs text-orange-700 space-y-1.5">
          <li>1. <strong>Select a template</strong> from the gallery above</li>
          <li>2. <strong>Customize content</strong> — edit title, description, CTA text</li>
          <li>3. <strong>Upload a logo</strong> (optional) — or use the default store logo</li>
          <li>4. Click <strong>&quot;Generate &amp; Publish&quot;</strong> — this creates the image and saves it</li>
          <li>5. The banner appears when someone shares your link on WhatsApp, Facebook, or Twitter</li>
        </ul>
        <p className="text-[11px] text-orange-500 mt-3">
          Note: Social platforms cache link previews. After generating a new banner, it may take up to
          24 hours for WhatsApp to show the updated image. You can force-refresh by appending ?v=2 to your URL when sharing.
        </p>
      </div>
    </div>
  );
}
