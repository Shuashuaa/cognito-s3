# cognito-s3

### `The Idea is to Upload Files to s3 and retrieve it to display in frontend`

1. create a test_bucket (mytestbucket-react)

whenever s3 bucket is applied (we have to indicate the credentials)
```
// Import S3 client and command
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

// Configure your S3 client (***SECURITY WARNING: Not recommended for production frontends***)
const s3Client = new S3Client({
  region: "YOUR_AWS_REGION", // Replace with your S3 bucket's region
  credentials: {
    accessKeyId: "YOUR_AWS_ACCESS_KEY_ID",     // Replace with your Access Key ID
    secretAccessKey: "YOUR_AWS_SECRET_ACCESS_KEY", // Replace with your Secret Access Key
  },
});

const S3_BUCKET_NAME = "YOUR_S3_BUCKET_NAME"; // Replace with your S3 bucket name
```
but it is not secured because the credentials: {} is shown in frontend.

<hr>

2. the best approach is

to use `temporary AWS credentials` 'cognito identity pool', Use the direct AWS SDK with temporary credentials obtained from Cognito Identity Pools.

```
npm install @aws-sdk/credential-provider-cognito-identity
```

### `Give a **temporary AWS credentials** temporary access (without implementing registration)`

3. congnito identity pool (sample_IAM_role, apply the `@aws-sdk/credential-provider-cognito-identity`)

```
// --- AWS Configuration ---
// Replace with your actual Cognito Identity Pool ID and Region
const IDENTITY_POOL_ID = "ap-southeast-1:cba70990-6a46-4e51-9224-7cd045a73c0a";
const COGNITO_REGION = "ap-southeast-1"; // Region where your Identity Pool is located

// Replace with your S3 bucket name and its Region
const S3_BUCKET_NAME = "mytestbucket-react";
const S3_BUCKET_REGION = "ap-southeast-1"; // Region where your S3 bucket is located

// Configure the S3 client using credentials from Cognito Identity Pool
const s3Client = new S3Client({
  region: S3_BUCKET_REGION, // Use the S3 bucket's region
  credentials: fromCognitoIdentityPool({
    identityPoolId: IDENTITY_POOL_ID,
    clientConfig: { region: COGNITO_REGION }, // Use the Cognito Identity Pool's region
  }),
});
```

4. Upon refresh check the identity pool if your unauthenticated access is listed by aws.

5. Set the bucket's policy CORS for the system's URL

Cross-origin resource sharing (CORS)
```
[
    {
        "AllowedHeaders": [
            "*"
        ],
        "AllowedMethods": [
            "GET",
            "PUT"
        ],
        "AllowedOrigins": [
            "http://10.169.141.201:5173"
        ],
        "ExposeHeaders": [
            "ETag"
        ]
    }
]
```

6. Set a permission for a specific identity to upload files to s3 (which is us).
IAM > roles > (sample_IAM_role) > permission policies > permissions defined * > edit > use visual or JSON

policy editor
```
{
	"Version": "2012-10-17",
	"Statement": [
		{
			"Sid": "VisualEditor0",
			"Effect": "Allow",
			"Action": "cognito-identity:GetCredentialsForIdentity",
			"Resource": "*"
		},
		{
			"Sid": "VisualEditor1",
			"Effect": "Allow",
			"Action": "s3:PutObject",
			"Resource": "arn:aws:s3:::mytestbucket-react/*"
		}
	]
}
```

7. Access the image using the system without turning the s3 bucket publicly.

	1. List the Images (ListBucket)
```
{
	"Version": "2012-10-17",
	"Statement": [
		{
			"Sid": "VisualEditor0",
			"Effect": "Allow",
			"Action": "cognito-identity:GetCredentialsForIdentity",
			"Resource": "*"
		},
		{
			"Sid": "VisualEditor1",
			"Effect": "Allow",
			"Action": [
				"s3:PutObject"
			],
			"Resource": "arn:aws:s3:::mytestbucket-react/*"
		},
		{
			"Effect": "Allow",
			"Action": "s3:ListBucket",
			"Resource": [
				"arn:aws:s3:::mytestbucket-react"
			]
		}
	]
}
```

*reference to the BucketList Code*
<a href="#" />

2. get the Objects-images using the IAM policy role (GetObject)

```
{
	"Version": "2012-10-17",
	"Statement": [
		{
			"Sid": "VisualEditor0",
			"Effect": "Allow",
			"Action": "cognito-identity:GetCredentialsForIdentity",
			"Resource": "*"
		},
		{
			"Sid": "VisualEditor1",
			"Effect": "Allow",
			"Action": [
				"s3:PutObject",
				"s3:GetObject"
			],
			"Resource": "arn:aws:s3:::mytestbucket-react/*"
		},
		{
			"Effect": "Allow",
			"Action": "s3:ListBucket",
			"Resource": [
				"arn:aws:s3:::mytestbucket-react"
			]
		}
	]
}
```

8. Since direct Object URLs are blocked because public access is off, we've added the `s3:GetObject` permission to the IAM policy. Now, we will use our `authenticated client` to access the objects by implementing `pre-signed URLs` for the GET requests.
```
install --
npm install @aws-sdk/s3-request-presigner

import --
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

add the GetObjectCommand --
import { S3Client, PutObjectCommand, ListObjectsV2Command, GetObjectCommand } from "@aws-sdk/client-s3"; 
```

### Changes with `fetchImages()`

```
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
```

*reference to the GetObject-Pre Sign URLs Code* the whole frontend code
<a href="#" />

====================================================================================================================
9. advance - to have a registration page, dynamic creation of AUTHORIZED identity pool instead of unauthorized.
====================================================================================================================

