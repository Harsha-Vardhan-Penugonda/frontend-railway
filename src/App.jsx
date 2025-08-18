import { useState, useRef, useEffect } from 'react';

// Main App Component
export default function App() {
  // State for form inputs
  const [trainNumber, setTrainNumber] = useState('');
  const [platformNumber, setPlatformNumber] = useState('');
  const [anncType, setAnncType] = useState('Is On');

  // State for API response and UI status
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [audioUrl, setAudioUrl] = useState(null);

  // Ref to access the audio element directly
  const audioRef = useRef(null);

  // The base URL for your backend API
  const baseUrl = 'https://train-announcer-backend-1.onrender.com';
  const apiUrl = `${baseUrl}/api/generate`;

  // Effect to automatically play audio when the URL changes
  useEffect(() => {
    if (audioUrl && audioRef.current) {
      audioRef.current.play().catch(e => console.error("Audio playback failed:", e));
    }
  }, [audioUrl]);

  // Function to handle form submission
  const handleSubmit = async (event) => {
    event.preventDefault(); // Prevent page reload

    // Reset state before making a new request
    setIsLoading(true);
    setError(null);
    setAudioUrl(null);

    // Basic validation
    if (!trainNumber || !platformNumber) {
        setError('Please fill in all fields.');
        setIsLoading(false);
        return;
    }

    const requestData = {
      trainNumber: parseInt(trainNumber, 10),
      platformNumber,
      anncType,
    };

    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API Error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();

      if (data.audioUrl) {
        // Construct the full URL and set it in state
        const fullAudioUrl = baseUrl + data.audioUrl;
        setAudioUrl(fullAudioUrl);
      } else {
        throw new Error('Audio URL not found in the server response.');
      }

    } catch (err) {
      console.error('Error fetching announcement:', err);
      setError(err.message || 'Failed to generate announcement. Please try again.');
    } finally {
      // This runs whether the request succeeded or failed
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-gray-100 font-sans flex items-center justify-center min-h-screen p-4">
      <div className="w-full max-w-md mx-auto bg-white rounded-2xl shadow-lg p-8 space-y-6">
        {/* Header Section */}
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-800">Railway Announcement</h1>
          <p className="text-gray-500 mt-2">Generate train announcements on the fly.</p>
        </div>

        {/* Form for user input */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Train Number Input */}
          <div>
            <label htmlFor="trainNumber" className="block text-sm font-medium text-gray-700 mb-1">
              Train Number
            </label>
            <input
              type="number"
              id="trainNumber"
              value={trainNumber}
              onChange={(e) => setTrainNumber(e.target.value)}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
              placeholder="e.g., 12711"
            />
          </div>

          {/* Platform Number Input */}
          <div>
            <label htmlFor="platformNumber" className="block text-sm font-medium text-gray-700 mb-1">
              Platform Number
            </label>
            <input
              type="text"
              id="platformNumber"
              value={platformNumber}
              onChange={(e) => setPlatformNumber(e.target.value)}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
              placeholder="e.g., 4"
            />
          </div>

          {/* Announcement Type Dropdown */}
          <div>
            <label htmlFor="anncType" className="block text-sm font-medium text-gray-700 mb-1">
              Announcement Type
            </label>
            <select
              id="anncType"
              value={anncType}
              onChange={(e) => setAnncType(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition bg-white"
            >
              <option value="Is On">Is On Platform</option>
              <option value="Arriving">Arriving</option>
              <option value="Departing">Departing</option>
            </select>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-blue-600 text-white font-semibold py-3 px-4 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-transform transform hover:scale-105 disabled:bg-blue-400 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Generating...' : 'Generate Announcement'}
          </button>
        </form>

        {/* Response Section: Loader, Audio Player, or Error Message */}
        <div className="pt-6 text-center min-h-[60px]">
          {isLoading && (
            <div className="loader ease-linear rounded-full border-4 border-t-4 border-gray-200 h-12 w-12 mx-auto" style={{ borderTopColor: '#3498db' }}></div>
          )}

          {error && (
            <div className="mt-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg">
              {error}
            </div>
          )}

          {audioUrl && !isLoading && (
            <audio ref={audioRef} src={audioUrl} controls className="w-full mt-4">
              Your browser does not support the audio element.
            </audio>
          )}
        </div>
      </div>
    </div>
  );
}
