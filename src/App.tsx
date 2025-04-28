import { useState, useEffect } from 'react';
import reactLogo from './assets/react.svg';
import viteLogo from '/vite.svg';
import './App.css';
import { Button } from './components/ui/button'; // Assuming shadcn/ui or similar
import { Input } from "./components/ui/input";   // Assuming shadcn/ui or similar
import { Label } from "./components/ui/label";     // Assuming shadcn/ui or similar

// Import S3 client and commands
import { S3Client, PutObjectCommand, ListObjectsV2Command, GetObjectCommand } from "@aws-sdk/client-s3";
// Import the Cognito Identity Pool credential provider
import { fromCognitoIdentityPool } from "@aws-sdk/credential-provider-cognito-identity";
// A pre-signed URL is a temporary URL created by your authenticated SDK client (using the credentials from the assumed role) 
// that includes a signature, allowing anyone with the URL to access the object for a limited time without needing 
// separate AWS credentials for the browser request.
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';


// --- AWS Configuration ---
// Replace with your actual Cognito Identity Pool ID and Region
const IDENTITY_POOL_ID = "ap-southeast-1:cba70990-6a46-4e51-9224-7cd045a73c0a";
const COGNITO_REGION = "ap-southeast-1"; // Region where your Identity Pool is located

// Replace with your S3 bucket name and its Region
const S3_BUCKET_NAME = "mytestbucket-react";
const S3_BUCKET_REGION = "ap-southeast-1"; // Region where your S3 bucket is located

// Base URL for accessing objects in your S3 bucket (if public read is enabled)
// Format: https://<bucket-name>.s3.<region>.amazonaws.com
// const S3_BASE_URL = `https://${S3_BUCKET_NAME}.s3.${S3_BUCKET_REGION}.amazonaws.com`;


// Configure the S3 client using credentials from Cognito Identity Pool
const s3Client = new S3Client({
  region: S3_BUCKET_REGION, // Use the S3 bucket's region
  credentials: fromCognitoIdentityPool({
    identityPoolId: IDENTITY_POOL_ID,
    clientConfig: { region: COGNITO_REGION }, // Use the Cognito Identity Pool's region
  }),
});

// --- End of AWS Configuration ---


function App() {
  const [count, setCount] = useState(0);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const [images, setImages] = useState<string[]>([]); // State to store image URLs
  const [loadingImages, setLoadingImages] = useState(false); // State for loading indicator

  // Function to fetch images from the S3 bucket
//   const fetchImages = async () => {
//     setLoadingImages(true);
//     try {
//       const command = new ListObjectsV2Command({
//         Bucket: S3_BUCKET_NAME,
//       });

//       const response = await s3Client.send(command);

//       // Filter for image files and construct their public URLs
//       const imageUrls = (response.Contents || [])
//         .filter(item => item.Key && /\.(jpg|jpeg|png|gif|bmp|svg)$/i.test(item.Key)) // Basic image file extension check
//         .map(item => `${S3_BASE_URL}/${item.Key}`); // Construct public URL

//       setImages(imageUrls);
//     } catch (error: any) {
//       console.error("Error fetching images:", error);
//       // Optionally set an error status for fetching images
//     } finally {
//       setLoadingImages(false);
//     }
//   };

const fetchImages = async () => {
  setLoadingImages(true);
  try {
    const command = new ListObjectsV2Command({
      Bucket: S3_BUCKET_NAME,
    });

    const response = await s3Client.send(command);

    const imageKeys = (response.Contents || [])
       .filter(item => item.Key && /\.(jpg|jpeg|png|gif|bmp|svg)$/i.test(item.Key))
       .map(item => item.Key); // Get just the keys

    // Generate a signed URL for each image key
    const imageUrls = await Promise.all(
      imageKeys.map(async (key) => {
        const getCommand = new GetObjectCommand({ // <-- Use GetObjectCommand
          Bucket: S3_BUCKET_NAME,
          Key: key,
        });
        // Generate the signed URL, valid for say, 3600 seconds (1 hour)
        const url = await getSignedUrl(s3Client, getCommand, { expiresIn: 3600 });
        return url;
      })
    );

    setImages(imageUrls);

  } catch (error: any) {
    console.error("Error fetching images:", error);
    // Optionally set an error status for fetching images
  } finally {
    setLoadingImages(false);
  }
};

  // Fetch images when the component mounts
  useEffect(() => {
    fetchImages();
  }, []); // Empty dependency array means this runs once on mount

  // Handles the file selection when the input changes
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      setSelectedFile(event.target.files[0]);
      setUploadStatus(null); // Clear previous upload status
    } else {
      setSelectedFile(null);
    }
  };

  // Handles the file upload process
  const handleUpload = async () => {
    if (!selectedFile) {
      setUploadStatus("Please select a file first.");
      return;
    }

    setUploading(true);
    setUploadStatus("Uploading...");

    try {
      // Read the file content into an ArrayBuffer.
      const fileContent = await selectedFile.arrayBuffer();
      const fileUint8Array = new Uint8Array(fileContent);

      const params = {
        Bucket: S3_BUCKET_NAME,
        Key: selectedFile.name, // Use the original file name as the S3 object key
        Body: fileUint8Array,  // Use the Uint8Array as the body of the S3 object
        ContentType: selectedFile.type, // Set the content type based on the file type
      };

      // Create and send the PutObjectCommand to upload the file to S3
      const command = new PutObjectCommand(params);
      await s3Client.send(command);

      // Update status on successful upload
      setUploadStatus(`Successfully uploaded ${selectedFile.name}`);
      setSelectedFile(null); // Clear the selected file after upload

      // After successful upload, refetch the image list to display the new image
      fetchImages();

    } catch (error: any) {
      // Log and display error message if upload fails
      console.error("Error uploading file:", error);
      setUploadStatus(`Error uploading file: ${error.message}`);
    } finally {
      // Set uploading state back to false
      setUploading(false);
    }
  };

  return (
    <div className="container mx-auto p-4"> {/* Added a container for better centering/padding */}
      <div className='flex justify-center mb-8'> {/* Added margin-bottom */}
        <a href="https://vite.dev" target="_blank" className="mr-4"> {/* Added margin-right */}
          <img src={viteLogo} className="logo w-20 h-20" alt="Vite logo" /> {/* Adjusted logo size */}
        </a>
        <a href="https://react.dev" target="_blank">
          <img src={reactLogo} className="logo react w-20 h-20" alt="React logo" /> {/* Adjusted logo size */}
        </a>
      </div>
      <h1 className="text-center text-2xl font-bold mb-6">Vite + React S3 Uploader & Viewer</h1> {/* Added text styling */}
      <div className="card bg-gray-100 p-6 rounded-lg shadow-md mb-8"> {/* Styled card */}
        <div className="flex items-center justify-center space-x-4 mb-4"> {/* Flex container for count button */}
          <Button onClick={() => setCount((count) => count + 1)}>
            count is {count}
          </Button>
        </div>

        <div className="grid w-full max-w-sm items-center gap-1.5 mx-auto mb-4"> {/* Centered and spaced input */}
          <Label htmlFor="picture" className="font-semibold">Select Picture to Upload</Label> {/* Styled label */}
          <Input id="picture" type="file" onChange={handleFileChange} className="bg-white" /> {/* Styled input */}
        </div>

        <div className="flex justify-center mb-4"> {/* Centered button */}
          <Button onClick={handleUpload} disabled={!selectedFile || uploading}>
            {uploading ? 'Uploading...' : 'Upload to S3'}
          </Button>
        </div>

        {uploadStatus && <p className={`text-center mt-2 ${uploadStatus.startsWith('Error') ? 'text-red-500' : 'text-green-600'}`}>{uploadStatus}</p>} {/* Styled status message */}

      </div>

      {/* Section to display images */}
      <div className="image-gallery mt-8"> {/* Added margin-top */}
        <h2 className="text-center text-xl font-bold mb-4">Images in S3 Bucket</h2> {/* Section title */}
        {loadingImages ? (
          <p className="text-center">Loading images...</p>
        ) : images.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4"> {/* Responsive grid for images */}
            
            {images.map((imageUrl, index) => (
              <div key={index} className="relative group"> {/* Container for each image */}
                <img
                  src={imageUrl}
                  alt={`S3 Image ${index + 1}`}
                  className="w-full h-40 object-cover rounded-lg shadow-md transition-transform transform group-hover:scale-105" // Styled image
                  onError={(e) => { // Handle potential image loading errors
                    const target = e.target as HTMLImageElement;
                    target.onerror = null; // Prevent infinite loop
                    target.src = `https://placehold.co/150x150/E0E0E0/333333?text=Image+Error`; // Placeholder on error
                  }}
                />
              </div>
            ))}

          </div>
        ) : (
          <p className="text-center">No images found in the bucket.</p>
        )}
      </div>

      <p className="read-the-docs text-center mt-8 text-gray-600"> {/* Styled footer text */}
        Click on the Vite and React logos to learn more
      </p>
    </div>
  );
}

export default App;
