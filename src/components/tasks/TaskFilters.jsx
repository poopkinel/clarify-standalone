<action type="file" filePath="pages/Topics.js">// ... keep existing code

// Update state to handle multiple selected tags
const [selectedTags, setSelectedTags] = useState([]);

// Update tag filtering logic
const getDisplayedTopics = () => {
  if (searchResults) {
    return searchResults;
  }
  
  // Apply regular filtering and sorting when no search
  let filteredTopics = topics;
  
  // Apply category filter
  if (activeCategory !== "all") {
    filteredTopics = filteredTopics.filter(topic => topic.category === activeCategory);
  }
  
  // Apply multiple tag filters if any are selected
  if (selectedTags.length > 0) {
    filteredTopics = filteredTopics.filter(topic => 
      // Topic must have all selected tags
      selectedTags.every(tag => topic.tags && topic.tags.includes(tag))
    );
  }

  return getSortedTopics(filteredTopics);
};

// Update the filter section in the render
return (
  // ... keep existing code until filter section

  <div className={`${filtersExpanded ? 'block' : 'hidden'} md:block`}>
    <div className="bg-white p-4 rounded-lg shadow-sm border mb-6">
      <div className="flex flex-col gap-4">
        {/* Combined filters section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Category filters */}
          <div>
            <label className="text-sm font-medium text-gray-700 mb-2 block">
              Categories
            </label>
            <div className="flex flex-wrap gap-2">
              <Button
                variant={activeCategory === "all" ? "default" : "outline"}
                onClick={() => setActiveCategory("all")}
                className={`whitespace-nowrap ${
                  activeCategory === "all" 
                    ? "bg-indigo-600 hover:bg-indigo-700 text-white font-medium" 
                    : "bg-white hover:bg-gray-50 text-gray-700"
                }`}
                size="sm"
              >
                All Categories
              </Button>
              {Object.entries(categoryCounts).map(([category, count]) => (
                <Button
                  key={category}
                  variant={activeCategory === category ? "default" : "outline"}
                  onClick={() => setActiveCategory(category)}
                  className={`whitespace-nowrap ${
                    activeCategory === category 
                      ? "bg-indigo-600 hover:bg-indigo-700 text-white font-medium" 
                      : "bg-white hover:bg-gray-50 text-gray-700"
                  }`}
                  size="sm"
                >
                  {category.charAt(0).toUpperCase() + category.slice(1)} ({count})
                </Button>
              ))}
            </div>
          </div>

          {/* Tag filters with multiple selection */}
          <div>
            <label className="text-sm font-medium text-gray-700 mb-2 block">
              Tags (select multiple)
            </label>
            <div className="flex flex-wrap gap-2 max-h-24 overflow-y-auto">
              {allTags.map((tag) => (
                <Button
                  key={tag}
                  variant={selectedTags.includes(tag) ? "default" : "outline"}
                  onClick={() => {
                    setSelectedTags(prev => 
                      prev.includes(tag)
                        ? prev.filter(t => t !== tag)  // Remove tag if already selected
                        : [...prev, tag]               // Add tag if not selected
                    );
                  }}
                  className={`whitespace-nowrap ${
                    selectedTags.includes(tag)
                      ? "bg-indigo-600 hover:bg-indigo-700 text-white font-medium" 
                      : "bg-white hover:bg-gray-50 text-gray-700"
                  }`}
                  size="sm"
                >
                  {tag} ({tagCounts[tag] || 0})
                </Button>
              ))}
            </div>
            {selectedTags.length > 0 && (
              <Button
                variant="ghost"
                onClick={() => setSelectedTags([])}
                className="mt-2 text-sm text-gray-600"
                size="sm"
              >
                Clear all tags
              </Button>
            )}
          </div>
        </div>

        {/* ... keep existing sort controls ... */}
      </div>
    </div>
  </div>

  {/* Active filter indicators - update to show multiple tags */}
  <div className="md:hidden mb-4">
    <div className="flex flex-wrap gap-2 items-center text-sm">
      <span className="text-gray-500">Showing:</span>
      <Badge variant="outline" className="bg-gray-50">
        {activeCategory === "all" 
          ? "All Topics" 
          : `${activeCategory.charAt(0).toUpperCase() + activeCategory.slice(1)}`
        }
      </Badge>
      
      {selectedTags.length > 0 && (
        <>
          <span className="text-gray-500">with tags:</span>
          {selectedTags.map(tag => (
            <Badge 
              key={tag}
              variant="outline" 
              className="bg-gray-50 flex items-center gap-1"
            >
              {tag}
              <X
                className="h-3 w-3 cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedTags(prev => prev.filter(t => t !== tag));
                }}
              />
            </Badge>
          ))}
        </>
      )}

      <span className="text-gray-500 ml-2">Sorted by:</span>
      <Badge variant="outline" className="bg-gray-50 flex items-center gap-1">
        {sortBy === "heat" && <Flame className="h-3 w-3 text-orange-500" />}
        {sortBy === "discussions" && <MessageCircle className="h-3 w-3 text-blue-500" />}
        {sortBy === "active" && <TrendingUp className="h-3 w-3 text-green-500" />}
        {sortBy === "participants" && <Users className="h-3 w-3 text-purple-500" />}
        <span>
          {sortBy === "heat" && "Heat"}
          {sortBy === "discussions" && "Discussions"}
          {sortBy === "active" && "Active"}
          {sortBy === "participants" && "Participants"}
        </span>
        {sortOrder === "desc" ? "↓" : "↑"}
      </Badge>
    </div>
  </div>

  {/* ... keep existing code ... */}
);