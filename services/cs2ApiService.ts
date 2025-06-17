import type { CS2Item } from "~/types/game";

export interface CS2ApiServiceOptions {
  cacheTimeout: number; // Cache timeout in milliseconds
  maxRetries: number;
  retryDelay: number;
}

export interface CachedApiData {
  items: CS2Item[];
  timestamp: number;
  version: string;
}

// Interface for the GitHub API response
interface GitHubApiWeapon {
  id: string;
  name: string;
  description: string | null;
  image: string;
}

// Interface for our server API response
interface ServerApiResponse {
  success: boolean;
  data?: GitHubApiWeapon[];
  error?: string;
  timestamp: string;
  count?: number;
}

class CS2ApiService {
  private readonly options: CS2ApiServiceOptions;
  private readonly cacheKey = "cs2-api-cache";
  private readonly cacheVersion = "1.1.0"; // Updated version for new API integration
  private readonly apiUrl = "/api/cs2/weapons"; // Use local API route instead of external URL

  constructor(options: Partial<CS2ApiServiceOptions> = {}) {
    this.options = {
      cacheTimeout: 24 * 60 * 60 * 1000, // 24 hours default
      maxRetries: 3,
      retryDelay: 1000,
      ...options,
    };
  }

  /**
   * Fetch CS2 items with caching and fallback
   */
  async getCS2Items(count: number = 100): Promise<CS2Item[]> {
    try {
      // Try to get from cache first
      const cachedData = this.getCachedData();
      if (cachedData && this.isCacheValid(cachedData)) {
        console.log("Using cached CS2 data");
        return this.selectRandomItems(cachedData.items, count);
      }

      // Try to fetch from API
      const items = await this.fetchFromApi();
      if (items.length > 0) {
        this.cacheData(items);
        return this.selectRandomItems(items, count);
      }

      // Fallback to cached data even if expired
      if (cachedData && cachedData.items.length > 0) {
        console.warn("Using expired cache as fallback");
        return this.selectRandomItems(cachedData.items, count);
      }

      // If no data available anywhere, throw error
      throw new Error("No CS2 data available from API or cache");
    } catch (error) {
      console.error("Error fetching CS2 items:", error);

      // Try cached data as fallback
      const cachedData = this.getCachedData();
      if (cachedData && cachedData.items.length > 0) {
        return this.selectRandomItems(cachedData.items, count);
      }

      throw error;
    }
  }

  /**
   * Fetch fresh data from local API route (which proxies GitHub API)
   */
  private async fetchFromApi(): Promise<CS2Item[]> {
    let retries = 0;
    while (retries < this.options.maxRetries) {
      try {
        console.log("Fetching CS2 weapons from local API route...");

        const response = await fetch(this.apiUrl, {
          headers: {
            "Content-Type": "application/json",
          },
          signal: AbortSignal.timeout(15000), // 15 second timeout for server route
        });

        if (!response.ok) {
          throw new Error(
            `Local API request failed: ${response.status} ${response.statusText}`
          );
        }

        const serverResponse: ServerApiResponse = await response.json();

        if (!serverResponse.success || !serverResponse.data) {
          throw new Error(
            serverResponse.error || "Server API returned unsuccessful response"
          );
        }

        const transformedItems = this.transformApiData(serverResponse.data);

        console.log(
          `Successfully fetched ${transformedItems.length} weapons from local API`
        );
        return transformedItems;
      } catch (error) {
        retries++;
        console.warn(`Local API request attempt ${retries} failed:`, error);

        if (retries < this.options.maxRetries) {
          await this.delay(this.options.retryDelay * retries);
        }
      }
    }

    throw new Error(
      `Failed to fetch from local API after ${this.options.maxRetries} attempts`
    );
  }

  /**
   * Transform GitHub API data to our CS2Item interface
   */
  private transformApiData(apiData: GitHubApiWeapon[]): CS2Item[] {
    return apiData
      .filter((weapon) => weapon.image && weapon.name) // Filter out items without images or names
      .map((weapon) => {
        // Determine category based on weapon ID
        let category: CS2Item["category"] = "weapon";
        let rarity: CS2Item["rarity"] = "consumer";

        if (weapon.id.includes("knife") || weapon.id.includes("bayonet")) {
          category = "knife";
          rarity = "covert";
        } else if (weapon.id.includes("gloves")) {
          category = "glove";
          rarity = "covert"; // Changed from 'extraordinary' to 'covert'
        } else if (
          weapon.id.includes("grenade") ||
          weapon.id.includes("c4") ||
          weapon.id.includes("healthshot")
        ) {
          // These will be categorized as weapons since 'equipment' is not a valid category
          category = "weapon";
          rarity = "consumer";
        } else {
          // Assign rarity based on weapon type for more interesting gameplay
          if (
            weapon.name.includes("AK-47") ||
            weapon.name.includes("AWP") ||
            weapon.name.includes("M4A4")
          ) {
            rarity = "covert";
          } else if (
            weapon.name.includes("Desert Eagle") ||
            weapon.name.includes("AUG") ||
            weapon.name.includes("SG 553")
          ) {
            rarity = "classified";
          } else if (
            weapon.name.includes("FAMAS") ||
            weapon.name.includes("Galil") ||
            weapon.name.includes("MP7")
          ) {
            rarity = "restricted";
          } else if (
            weapon.name.includes("P90") ||
            weapon.name.includes("Nova") ||
            weapon.name.includes("UMP-45")
          ) {
            rarity = "milSpec"; // Changed from 'mil-spec' to 'milSpec'
          }
        }

        return {
          id: weapon.id,
          name: weapon.name,
          imageUrl: weapon.image,
          rarity,
          category,
          collection: "Base Weapons Collection",
          exterior: "Factory New",
          description:
            weapon.description || `Standard ${weapon.name} from Counter-Strike`,
        };
      });
  }

  /**
   * Get cached data from localStorage
   */
  private getCachedData(): CachedApiData | null {
    try {
      if (typeof localStorage === "undefined") return null;

      const cached = localStorage.getItem(this.cacheKey);
      if (!cached) return null;

      const data: CachedApiData = JSON.parse(cached);

      // Validate cache structure
      if (
        !data.items ||
        !Array.isArray(data.items) ||
        !data.timestamp ||
        !data.version
      ) {
        console.warn("Invalid cache structure, clearing cache");
        this.clearCache();
        return null;
      }

      return data;
    } catch (error) {
      console.error("Error reading cache:", error);
      this.clearCache();
      return null;
    }
  }

  /**
   * Cache data to localStorage
   */
  private cacheData(items: CS2Item[]): void {
    try {
      if (typeof localStorage === "undefined") return;

      const cacheData: CachedApiData = {
        items,
        timestamp: Date.now(),
        version: this.cacheVersion,
      };

      localStorage.setItem(this.cacheKey, JSON.stringify(cacheData));
      console.log(`Cached ${items.length} CS2 items`);
    } catch (error) {
      console.error("Error caching data:", error);
    }
  }

  /**
   * Check if cached data is still valid
   */
  private isCacheValid(data: CachedApiData): boolean {
    const now = Date.now();
    const age = now - data.timestamp;

    // Check version compatibility
    if (data.version !== this.cacheVersion) {
      return false;
    }

    // Check age
    return age < this.options.cacheTimeout;
  }

  /**
   * Clear cached data
   */
  clearCache(): void {
    try {
      if (typeof localStorage !== "undefined") {
        localStorage.removeItem(this.cacheKey);
        console.log("CS2 API cache cleared");
      }
    } catch (error) {
      console.error("Error clearing cache:", error);
    }
  }

  /**
   * Select random items from array
   */
  private selectRandomItems(items: CS2Item[], count: number): CS2Item[] {
    if (items.length <= count) return [...items];

    const shuffled = [...items].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count);
  }

  /**
   * Utility delay function
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Get cache status information
   */
  getCacheStatus(): {
    hasCache: boolean;
    isValid: boolean;
    itemCount: number;
    age: number;
  } {
    const cached = this.getCachedData();

    if (!cached) {
      return { hasCache: false, isValid: false, itemCount: 0, age: 0 };
    }

    const age = Date.now() - cached.timestamp;
    const isValid = this.isCacheValid(cached);

    return {
      hasCache: true,
      isValid,
      itemCount: cached.items.length,
      age,
    };
  }

  /**
   * Get available weapon categories for filtering
   */
  getAvailableCategories(): Promise<string[]> {
    return this.getCS2Items(1000).then((items) => {
      const categories = new Set(items.map((item) => item.category));
      return Array.from(categories);
    });
  }

  /**
   * Filter items by category
   */
  async getItemsByCategory(
    category: string,
    count: number = 50
  ): Promise<CS2Item[]> {
    const allItems = await this.getCS2Items(1000);
    const filteredItems = allItems.filter((item) => item.category === category);
    return this.selectRandomItems(filteredItems, count);
  }
}

// Export singleton instance
export const cs2ApiService = new CS2ApiService();
export default cs2ApiService;
