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

  // A comprehensive list of sample train numbers from the provided images
  const sampleTrainNumbers = [
    12077, 12078, 12375, 12376, 12603, 12604, 12612, 12615, 12616, 12622, 
    12655, 12656, 12659, 12660, 12664, 12703, 12709, 12710, 12711, 12712, 
    12727, 12733, 12734, 12743, 12744, 12747, 12749, 12759, 12760, 12763, 
    12764, 12769, 12784, 12787, 12805, 17008, 17016, 17206, 17208, 17210, 
    17231, 17482, 17487, 17646, 17784, 17977, 18047, 18464, 18503, 18519, 
    18638, 20677, 22604, 22642, 22832, 22849, 22852, 22859, 22880, 70458, 
    70461, 70637, 70785, 70786, 86086
  ].sort((a, b) => a - b); // Sorted numerically for better presentation

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
          <h1 className="text-3xl font-bold text-gray-800">Simulation of Railway Announcement</h1>
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
              <option value="Arrive Shortly">Arriving</option>
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

        {/* Sample Train Numbers Section */}
        <div className="pt-4 border-t border-gray-200">
            <h3 className="text-md font-semibold text-gray-700 mb-3 text-center">Or try one of these</h3>
            {/* Scrollable container for the train numbers */}
            <div className="max-h-32 overflow-y-auto p-2 bg-gray-50 rounded-lg flex flex-wrap justify-center gap-2">
                {sampleTrainNumbers.map((number) => (
                    <button
                        key={number}
                        type="button"
                        onClick={() => setTrainNumber(String(number))}
                        className="px-3 py-1 bg-gray-200 text-gray-800 rounded-full text-sm font-medium hover:bg-blue-500 hover:text-white focus:outline-none focus:ring-2 focus:ring-blue-400 transition"
                    >
                        {number}
                    </button>
                ))}
            </div>
        </div>


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
