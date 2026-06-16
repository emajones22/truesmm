import { useState } from "react";
import type { ApiPanel } from "../types/order";
import { Button, Card, Input, StatusPill, EmptyState } from "./ui";

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
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-indigo-600">Connections</p>
          <h2 className="mt-1 text-xl font-bold text-slate-900">API network</h2>
          <p className="mt-1 text-sm text-slate-500">Connect and manage your SMM API endpoints.</p>
        </div>
        <Button
          variant={showForm ? "secondary" : "primary"}
          onClick={() => setShowForm((prev) => !prev)}
          icon={
            showForm ? null : (
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
            )
          }
        >
          {showForm ? "Close" : "Add connection"}
        </Button>
      </div>

      {/* Add Form */}
      {showForm && (
        <Card padding="md">
          <h3 className="text-sm font-semibold text-slate-900 mb-4">New connection</h3>
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
            className="space-y-4"
          >
            <div className="grid gap-3 sm:grid-cols-3">
              <Input
                label="Connection name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="e.g. Main Panel"
              />
              <Input
                label="API URL"
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                placeholder="https://api.example.com/v2"
              />
              <Input
                label="API Key"
                value={key}
                onChange={(event) => setKey(event.target.value)}
                placeholder="Your API key"
                type="password"
              />
            </div>
            <Button type="submit" variant="primary">Save connection</Button>
          </form>
        </Card>
      )}

      {/* API List */}
      {apis.length === 0 ? (
        <EmptyState
          icon={
            <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
          }
          title="No API connections"
          description="Add your first connection to start managing services and bundles."
          action={
            <Button variant="primary" onClick={() => setShowForm(true)}>Add connection</Button>
          }
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {apis.map((api) => (
            <Card key={api.id} padding="md" hover>
              {/* Edit Mode */}
              {editingId === api.id ? (
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-slate-900">Edit connection</h3>
                  <Input
                    label="Connection name"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                  />
                  <Input
                    label="API URL"
                    value={editUrl}
                    onChange={(e) => setEditUrl(e.target.value)}
                  />
                  <Input
                    label="API Key"
                    type="password"
                    value={editKey}
                    onChange={(e) => setEditKey(e.target.value)}
                  />
                  <div className="flex gap-2 pt-1">
                    <Button variant="primary" fullWidth onClick={saveEdit}>Save</Button>
                    <Button variant="outline" fullWidth onClick={cancelEdit}>Cancel</Button>
                  </div>
                </div>

              /* Delete Confirm Mode */
              ) : deleteId === api.id ? (
                <div className="space-y-3">
                  <p className="text-sm text-rose-700">
                    Disconnect "{api.name}" from the network?
                  </p>
                  <div className="flex gap-2">
                    <Button variant="danger" fullWidth onClick={handleDelete}>Yes, disconnect</Button>
                    <Button variant="outline" fullWidth onClick={() => setDeleteId(null)}>Cancel</Button>
                  </div>
                </div>

              /* Normal View */
              ) : (
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <h3 className="text-base font-semibold text-slate-900 truncate">{api.name}</h3>
                      <p className="mt-1 text-xs text-slate-500 break-all font-mono">{api.url}</p>
                      <p className="mt-1 text-xs text-slate-500">{api.services.length} services linked</p>
                      {api.lastFetchError && (
                        <p className="mt-1 text-xs text-rose-600 break-words">{api.lastFetchError}</p>
                      )}
                    </div>
                    <StatusPill kind={api.status === "Active" ? "success" : "neutral"}>
                      {api.status}
                    </StatusPill>
                  </div>

                  <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-100">
                    <Button
                      size="sm"
                      variant="outline"
                      loading={fetchingApiId === api.id}
                      disabled={fetchingApiId === api.id}
                      onClick={() => onFetchServices(api.id)}
                    >
                      Sync services
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => startEdit(api)}>
                      Edit
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => onToggleStatus(api.id)}>
                      {api.status === "Active" ? "Disable" : "Enable"}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => confirmDelete(api.id)} className="text-rose-600 hover:bg-rose-50">
                      Delete
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
