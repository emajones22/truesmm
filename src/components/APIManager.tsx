import { useState } from "react";
import type { ApiPanel } from "../types/order";

interface APIManagerProps {
  apis: ApiPanel[];
  onAddApi: (api: { name: string; url: string; key: string }) => void;
  onEditApi: (id: string, api: { name: string; url: string; key: string }) => void;
  onDeleteApi: (id: string) => void;
  onToggleStatus: (id: string) => void;
  onFetchServices: (id: string) => void;
  fetchingApiId: string | null;
}

export function APIManager({ apis, onAddApi, onEditApi, onDeleteApi, onToggleStatus, onFetchServices, fetchingApiId }: APIManagerProps) {
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [key, setKey] = useState("");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editUrl, setEditUrl] = useState("");
  const [editKey, setEditKey] = useState("");

  const [deleteId, setDeleteId] = useState<string | null>(null);

  const startEdit = (api: ApiPanel) => {
    setEditingId(api.id);
    setEditName(api.name);
    setEditUrl(api.url);
    setEditKey(api.key);
  };

  const saveEdit = () => {
    if (!editName.trim() || !editUrl.trim() || !editKey.trim() || !editingId) return;
    onEditApi(editingId, { name: editName.trim(), url: editUrl.trim(), key: editKey.trim() });
    setEditingId(null);
  };

  const cancelEdit = () => { setEditingId(null); };
  const confirmDelete = (id: string) => { setDeleteId(id); };
  const handleDelete = () => {
    if (deleteId) { onDeleteApi(deleteId); setDeleteId(null); }
  };

  return (
    <section className="space-y-4 sm:space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 sm:gap-3">
          <span className="text-xl sm:text-2xl">🔗</span>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-blue-600">
            API Network
          </h2>
        </div>
        <button
          type="button"
          onClick={() => setShowForm((prev) => !prev)}
          className="rounded-lg border border-blue-300 bg-blue-50 px-3 py-1.5 text-xs sm:px-4 sm:py-2 sm:text-sm font-medium text-blue-700 transition hover:bg-blue-100"
        >
          {showForm ? "✕ Close" : "➕ Add"}
        </button>
      </div>

      {/* Add Form */}
      {showForm && (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (!name.trim() || !url.trim() || !key.trim()) return;
            onAddApi({ name: name.trim(), url: url.trim(), key: key.trim() });
            setName("");
            setUrl("");
            setKey("");
            setShowForm(false);
          }}
          className="space-y-2 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5"
        >
          <h3 className="text-xs font-semibold text-blue-600 mb-3">➕ New Connection</h3>
          <div className="grid gap-2 sm:grid-cols-3">
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Connection Name"
              className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 outline-none focus:border-blue-300"
            />
            <input
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              placeholder="API URL"
              className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 outline-none focus:border-blue-300"
            />
            <input
              value={key}
              onChange={(event) => setKey(event.target.value)}
              placeholder="API Key"
              className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 outline-none focus:border-blue-300"
            />
          </div>
          <button
            type="submit"
            className="w-full rounded-lg border border-blue-300 bg-blue-100 px-3 py-2 text-sm font-medium text-blue-700 transition hover:bg-blue-100"
          >
            Save Connection
          </button>
        </form>
      )}

      {/* API List */}
      <div className="space-y-3">
        {apis.length === 0 && (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center">
            <span className="text-4xl">🚀</span>
            <p className="mt-2 text-sm text-slate-500">No API connections established</p>
            <p className="mt-1 text-xs text-slate-600">Add your first connection to the network</p>
          </div>
        )}

        {apis.map((api) => (
          <article
            key={api.id}
            className="rounded-2xl border border-slate-200 bg-white p-4"
          >
            {/* Edit Mode */}
            {editingId === api.id ? (
              <div className="space-y-2">
                <h3 className="text-xs font-semibold text-blue-600 mb-2">✏️ Edit Connection</h3>
                <input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="Connection Name"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-300"
                />
                <input
                  value={editUrl}
                  onChange={(e) => setEditUrl(e.target.value)}
                  placeholder="API URL"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-300"
                />
                <input
                  value={editKey}
                  onChange={(e) => setEditKey(e.target.value)}
                  placeholder="API Key"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-300"
                />
                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={saveEdit}
                    className="flex-1 rounded-lg border border-blue-300 bg-blue-100 px-3 py-2 text-sm text-blue-700 transition hover:bg-blue-100"
                  >
                    ✓ Save
                  </button>
                  <button
                    type="button"
                    onClick={cancelEdit}
                    className="flex-1 rounded-lg border border-slate-200 bg-slate-100 px-3 py-2 text-sm text-slate-600 transition hover:bg-slate-200"
                  >
                    ✕ Cancel
                  </button>
                </div>
              </div>

            /* Delete Confirm Mode */
            ) : deleteId === api.id ? (
              <div className="space-y-3">
                <p className="text-sm text-rose-600">
                  ⚠️ Disconnect "{api.name}" from the network?
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleDelete}
                    className="flex-1 rounded-lg border border-rose-300 bg-rose-100 px-3 py-2 text-sm text-rose-700 transition hover:bg-rose-200"
                  >
                    Yes, Disconnect
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteId(null)}
                    className="flex-1 rounded-lg border border-slate-200 bg-slate-100 px-3 py-2 text-sm text-slate-600 transition hover:bg-slate-200"
                  >
                    Cancel
                  </button>
                </div>
              </div>

            /* Normal View */
            ) : (
              <div className="space-y-3">

                {/* Top Row - Name + Status */}
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm sm:text-base font-semibold text-blue-600 truncate">
                      {api.name}
                    </h3>
                    <p className="mt-0.5 text-xs text-slate-500 break-all">{api.url}</p>
                    <p className="mt-1 text-xs text-slate-600">{api.services.length} services linked</p>
                    {api.lastFetchError && (
                      <p className="mt-1 text-xs text-rose-600 break-words">{api.lastFetchError}</p>
                    )}
                  </div>
                  <div className="flex-shrink-0 text-right">
                    <p className={`text-sm font-semibold ${api.status === "Active" ? "text-emerald-600" : "text-slate-500"}`}>
                      {api.status}
                    </p>
                    <button
                      type="button"
                      onClick={() => onToggleStatus(api.id)}
                      className="mt-1 block text-xs text-blue-600 hover:text-blue-600"
                    >
                      Toggle
                    </button>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => onFetchServices(api.id)}
                    disabled={fetchingApiId === api.id}
                    className="flex-1 min-w-0 rounded-md border border-blue-300 bg-blue-50 px-2 py-1.5 text-xs text-blue-700 transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-60 text-center"
                  >
                    {fetchingApiId === api.id ? "⏳ Syncing..." : "🔄 Sync Services"}
                  </button>
                  <button
                    type="button"
                    onClick={() => startEdit(api)}
                    className="rounded-md border border-slate-200 bg-blue-50 px-3 py-1.5 text-xs text-blue-700 transition hover:bg-blue-100"
                  >
                    ✏️ Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => confirmDelete(api.id)}
                    className="rounded-md border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs text-rose-700 transition hover:bg-rose-100"
                  >
                    🗑️ Delete
                  </button>
                </div>
              </div>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
