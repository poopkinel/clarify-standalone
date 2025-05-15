import React, { useState, useEffect } from "react";
import { User } from "@/api/entities";
import { Topic } from "@/api/entities";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Plus,
  Pencil,
  Trash2,
  AlertCircle,
  CheckCircle2,
  XCircle,
  X,
  Image,
  Sparkles,
  Loader2,
  Globe
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useAppToast } from "@/components/utils/toast";
import { GenerateImage } from "@/api/integrations";

// Helper function to suggest image URLs based on topic content
const suggestImageUrl = (topic) => {
  const categoryImages = {
    politics: "https://images.unsplash.com/photo-1575320181282-9afab399332c?q=80&w=800",
    ethics: "https://images.unsplash.com/photo-1589829545856-d10d557cf95f?q=80&w=800",
    technology: "https://images.unsplash.com/photo-1518770660439-4636190af475?q=80&w=800",
    environment: "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?q=80&w=800",
    education: "https://images.unsplash.com/photo-1503676260728-1c00da094a0b?q=80&w=800",
    healthcare: "https://images.unsplash.com/photo-1505751172876-fa1923c5c528?q=80&w=800",
    economics: "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?q=80&w=800"
  };
  
  return categoryImages[topic.tags?.[0]] || "";
};

export default function AdminTopics() {
  const [topics, setTopics] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedTopic, setSelectedTopic] = useState(null);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    tags: [],
    language: "en",
    image_url: "",
    active: true
  });
  const [suggestedImage, setSuggestedImage] = useState("");
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  
  const { showToast } = useAppToast();

  useEffect(() => {
    checkAdmin();
    loadTopics();
  }, []);

  const checkAdmin = async () => {
    try {
      const user = await User.me();
      setIsAdmin(user.role === 'admin');
      if (user.role !== 'admin') {
        showToast(
          "Access Denied",
          "You don't have permission to access this page",
          "destructive"
        );
      }
    } catch (error) {
      console.error("Error checking admin status:", error);
      setIsAdmin(false);
    }
  };

  const loadTopics = async () => {
    try {
      // Load all topics including inactive ones for admin
      const topicsData = await Topic.list();
      setTopics(topicsData);
    } catch (error) {
      console.error("Error loading topics:", error);
      showToast(
        "Error loading topics",
        "Please try again later",
        "destructive"
      );
    }
    setIsLoading(false);
  };

  const handleAdd = () => {
    const initialData = {
      title: "",
      description: "",
      tags: [],
      language: "en",
      image_url: "",
      active: true
    };
    
    setFormData(initialData);
    setSuggestedImage(suggestImageUrl(initialData));
    setShowAddDialog(true);
  };

  const handleEdit = (topic) => {
    setSelectedTopic(topic);
    setFormData({
      title: topic.title,
      description: topic.description,
      tags: topic.tags || [],
      language: topic.language || "en",
      image_url: topic.image_url || "",
      active: topic.active !== false  // Default to true if not set
    });
    setSuggestedImage(suggestImageUrl(topic));
    setShowEditDialog(true);
  };
  
  // Update suggested image when category changes
  useEffect(() => {
    if (showAddDialog || showEditDialog) {
      setSuggestedImage(suggestImageUrl(formData));
    }
  }, [formData.tags]);

  const handleDelete = (topic) => {
    setSelectedTopic(topic);
    setShowDeleteDialog(true);
  };

  // Add function to get fallback image from Unsplash
  const getFallbackImage = (topic) => {
    // Create a search query based on topic details
    const searchTerms = [
      topic.title,
      ...(topic.tags || []),
      'discussion',
      'debate'
    ].filter(Boolean).slice(0, 3);
    
    const searchQuery = encodeURIComponent(searchTerms.join(' '));
    return `https://source.unsplash.com/1600x900/?${searchQuery}`;
  };

  // Update the generateTopicImage function to only use Unsplash
  const generateTopicImage = async () => {
    if (isGeneratingImage) return;
    
    setIsGeneratingImage(true);
    
    try {
      // Create a search query based on topic details
      const searchTerms = [
        formData.title,
        ...(formData.tags || []),
        'discussion'
      ].filter(Boolean).slice(0, 3);
      
      const searchQuery = encodeURIComponent(searchTerms.join(' '));
      const imageUrl = `https://source.unsplash.com/1600x900/?${searchQuery}`;
      
      showToast(
        "Fetching image",
        "Finding a relevant image for this topic...",
        "default"
      );
      
      // Add a slight delay to allow Unsplash to respond
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Set the image URL
      setFormData({
        ...formData,
        image_url: imageUrl
      });
      
      showToast(
        "Image added",
        "A relevant image has been added to the topic",
        "success"
      );
    } catch (error) {
      console.error("Error generating image:", error);
      showToast(
        "Error finding image",
        "Please try adding an image URL manually",
        "destructive"
      );
    } finally {
      setIsGeneratingImage(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      // Create a new object with all form data and explicitly set active status
      const formDataWithTaggedCategory = { 
        ...formData,
        active: Boolean(formData.active), // Ensure it's a boolean
        tags: Array.from(new Set([...(formData.tags || [])]))
      };
      
      if (showAddDialog) {
        await Topic.create(formDataWithTaggedCategory);
        showToast(
          "Topic created",
          "The topic has been created successfully",
          "success"
        );
      } else if (showEditDialog && selectedTopic) {
        // Explicitly include active status in update
        await Topic.update(selectedTopic.id, {
          ...formDataWithTaggedCategory,
          active: Boolean(formData.active) // Ensure it's a boolean here too
        });
        showToast(
          "Topic updated",
          "The topic has been updated successfully",
          "success"
        );
      }
      
      // Clear all topic-related cache
      localStorage.removeItem('topicsPageData');
      localStorage.removeItem('cachedTrendingTopics');
      localStorage.setItem('lastTopicUpdate', Date.now().toString());
      
      await loadTopics();
      
      setShowAddDialog(false);
      setShowEditDialog(false);
      setSelectedTopic(null);
    } catch (error) {
      console.error("Error saving topic:", error);
      showToast(
        "Error saving topic",
        "Please try again later",
        "destructive"
      );
    }
  };

  const handleConfirmDelete = async () => {
    try {
      await Topic.delete(selectedTopic.id);
      
      // Clear cached topics data from localStorage
      localStorage.removeItem('cachedTrendingTopics');
      localStorage.removeItem('topicsPageData');
      
      showToast(
        "Topic deleted",
        "The topic has been deleted successfully",
        "success"
      );
      loadTopics();
      setShowDeleteDialog(false);
      setSelectedTopic(null);
    } catch (error) {
      console.error("Error deleting topic:", error);
      showToast(
        "Error deleting topic",
        "Please try again later",
        "destructive"
      );
    }
  };

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h1>
          <p className="text-gray-600">You don't have permission to view this page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Manage Topics</h1>
          <p className="text-gray-600 mt-1">
            Create, edit, and manage discussion topics
          </p>
        </div>
        <Button onClick={handleAdd} className="bg-indigo-600 hover:bg-indigo-700">
          <Plus className="h-5 w-5 mr-2" />
          Add Topic
        </Button>
      </div>

      {isLoading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading topics...</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Tags</TableHead>
                <TableHead>Language</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {topics.map((topic) => (
                <TableRow key={topic.id}>
                  <TableCell className="font-medium">{topic.title}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {topic.tags && topic.tags.slice(0, 3).map((tag, index) => (
                        <Badge key={index} variant="secondary" className="capitalize">
                          {tag}
                        </Badge>
                      ))}
                      {topic.tags && topic.tags.length > 3 && (
                        <Badge variant="outline">+{topic.tags.length - 3}</Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge className={`${topic.language === 'he' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'}`}>
                      {topic.language === 'he' ? 'Hebrew' : 'English'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {topic.active ? (
                      <Badge className="bg-green-100 text-green-800">Active</Badge>
                    ) : (
                      <Badge variant="secondary">Inactive</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => handleEdit(topic)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        className="text-red-600 hover:text-red-700"
                        onClick={() => handleDelete(topic)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Add/Edit Dialog with Fixed Contrast and Scrolling */}
      <Dialog open={showAddDialog || showEditDialog} onOpenChange={() => {
        setShowAddDialog(false);
        setShowEditDialog(false);
      }}>
        <DialogContent className="sm:max-w-md bg-white max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {showAddDialog ? "Add Topic" : "Edit Topic"}
            </DialogTitle>
            <DialogDescription>
              {showAddDialog 
                ? "Create a new discussion topic" 
                : "Edit the selected topic"}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Title</label>
              <Input
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Enter topic title"
                required
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Description</label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Enter topic description"
                required
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Topic Language</label>
              <Select
                value={formData.language || "en"}
                onValueChange={(value) => setFormData({ ...formData, language: value })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select language" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="he">Hebrew</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500">
                This determines the primary language for the topic and AI responses
              </p>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Tags</label>
              <div className="flex flex-wrap gap-2 mb-2">
                {formData.tags && formData.tags.map((tag, index) => (
                  <Badge 
                    key={index}
                    variant="secondary"
                    className="px-2 py-1 text-sm flex items-center gap-1"
                  >
                    {tag}
                    <X 
                      className="h-3 w-3 cursor-pointer" 
                      onClick={() => {
                        setFormData({
                          ...formData,
                          tags: formData.tags.filter((_, i) => i !== index)
                        });
                      }}
                    />
                  </Badge>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  id="tagInput"
                  placeholder="Add a tag"
                  className="flex-1"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && e.target.value.trim()) {
                      e.preventDefault();
                      const newTag = e.target.value.trim().toLowerCase();
                      setFormData({
                        ...formData,
                        tags: [...(formData.tags || []), newTag]
                      });
                      e.target.value = '';
                    }
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    const input = document.getElementById('tagInput');
                    if (input.value.trim()) {
                      const newTag = input.value.trim().toLowerCase();
                      setFormData({
                        ...formData,
                        tags: [...(formData.tags || []), newTag]
                      });
                      input.value = '';
                    }
                  }}
                >
                  Add
                </Button>
              </div>
              <p className="text-xs text-gray-500 mb-2">Add tags like "politics", "ethics", "technology", etc. to categorize this topic.</p>
              
              {/* Suggested common tags */}
              <div className="mt-2">
                <label className="text-xs font-medium text-gray-500 mb-1 block">Suggested Tags:</label>
                <div className="flex flex-wrap gap-1">
                  {["politics", "ethics", "technology", "environment", "education", "healthcare", "economics"].map(tag => (
                    <Button
                      key={tag}
                      type="button"
                      variant="outline"
                      size="sm"
                      className="text-xs py-1"
                      onClick={() => {
                        if (!formData.tags?.includes(tag)) {
                          setFormData({
                            ...formData,
                            tags: [...(formData.tags || []), tag]
                          });
                        }
                      }}
                    >
                      {tag}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
            
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-sm font-medium">Image URL</label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={generateTopicImage}
                  disabled={isGeneratingImage}
                  className="flex items-center gap-1"
                >
                  {isGeneratingImage ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span>Generating...</span>
                    </>
                  ) : (
                    <>
                      <Image className="h-3.5 w-3.5" />
                      <span>Fetch Image</span>
                    </>
                  )}
                </Button>
              </div>
              <Input
                value={formData.image_url}
                onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
                placeholder="Enter image URL (optional)"
              />
              
              {/* Image preview */}
              {formData.image_url && (
                <div className="mt-2 border rounded-md overflow-hidden">
                  <img
                    src={formData.image_url}
                    alt="Topic preview"
                    className="w-full h-40 object-cover"
                    onError={(e) => {
                      e.target.onerror = null;
                      e.target.src = "https://images.unsplash.com/photo-1589829545856-d10d557cf95f?q=80&w=800"; // Fallback image
                      showToast("Image URL error", "The provided URL couldn't be loaded", "destructive");
                    }}
                  />
                </div>
              )}
              
              {/* Suggested image preview */}
              {suggestedImage && !formData.image_url && (
                <div className="mt-2">
                  <p className="text-xs text-gray-500 mb-1">Suggested image for this category:</p>
                  <div className="relative h-32 rounded overflow-hidden">
                    <img 
                      src={suggestedImage} 
                      alt="Suggested topic image" 
                      className="w-full h-full object-cover"
                    />
                    <Button
                      type="button"
                      size="sm"
                      className="absolute bottom-2 right-2 bg-indigo-600 hover:bg-indigo-700"
                      onClick={() => setFormData({...formData, image_url: suggestedImage})}
                    >
                      Use this image
                    </Button>
                  </div>
                </div>
              )}
            </div>
            
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="active"
                checked={Boolean(formData.active)}
                onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                className="rounded border-gray-300"
              />
              <label htmlFor="active" className="text-sm font-medium">
                Active
              </label>
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowAddDialog(false);
                  setShowEditDialog(false);
                }}
              >
                Cancel
              </Button>
              <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700">
                {showAddDialog ? "Create Topic" : "Save Changes"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="bg-white">
          <DialogHeader>
            <DialogTitle>Delete Topic</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{selectedTopic?.title}"? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDeleteDialog(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmDelete}
            >
              Delete Topic
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}