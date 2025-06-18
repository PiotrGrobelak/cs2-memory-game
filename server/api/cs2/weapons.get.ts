export default defineEventHandler(async (event) => {
  try {
    // GitHub API endpoint for CS2/CSGO base weapons
    const apiUrl =
      "https://raw.githubusercontent.com/ByMykel/CSGO-API/main/public/api/en/base_weapons.json";

    console.log("Fetching CS2 weapons from GitHub API via server route...");

    // Fetch data from GitHub API
    const response = await fetch(apiUrl, {
      headers: {
        "User-Agent": "CS2-Memory-Game/1.0.0",
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(
        `GitHub API request failed: ${response.status} ${response.statusText}`,
      );
    }

    const weaponsData = await response.json();

    console.log(
      `Successfully fetched ${weaponsData.length} weapons from GitHub API`,
    );

    // Set cache headers for better performance
    setHeader(event, "Cache-Control", "public, max-age=3600"); // Cache for 1 hour
    setHeader(event, "Access-Control-Allow-Origin", "*");
    setHeader(event, "Content-Type", "application/json");

    return {
      success: true,
      data: weaponsData,
      timestamp: new Date().toISOString(),
      count: weaponsData.length,
    };
  } catch (error) {
    console.error("Error fetching CS2 weapons:", error);

    // Set error response headers
    setResponseStatus(event, 500);

    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred",
      timestamp: new Date().toISOString(),
    };
  }
});
