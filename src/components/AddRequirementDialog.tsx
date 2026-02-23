import { useState } from "react";
import { Requirement } from "@/types/requirement";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus } from "lucide-react";

interface Props {
  onAdd: (title: string, description: string, priority: Requirement["priority"]) => void;
}

export function AddRequirementDialog({ onAdd }: Props) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<Requirement["priority"]>("medium");

  const handleSubmit = () => {
    if (!title.trim()) return;
    onAdd(title.trim(), description.trim(), priority);
    setTitle("");
    setDescription("");
    setPriority("medium");
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          Add Requirement
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New Requirement</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4 pt-2">
          <Input
            placeholder="Requirement title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <Textarea
            placeholder="Description..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
          />
          <Select value={priority} onValueChange={(v) => setPriority(v as Requirement["priority"])}>
            <SelectTrigger>
              <SelectValue placeholder="Priority" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="low">Low</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="critical">Critical</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={handleSubmit} disabled={!title.trim()}>
            Create Requirement
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
