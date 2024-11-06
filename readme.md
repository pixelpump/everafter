# Everafter

Everafter is a web application designed to facilitate image uploads and gallery management, offering a dynamic platform for users to share and interact with visual content. It was intended as a method for event coordinators to gather imagery shot at events from attendees.
## Table of Contents

- [Features](#features)
- [Installation](#installation)
- [Usage](#usage)
- [Planned Features](#planned-features)
- [Contributing](#contributing)
- [License](#license)

## Features

As of the current alpha release, Everafter includes the following features:

- **Image Uploads**: Users can upload images to the platform, contributing to a shared gallery.

- **Live Feed**: A real-time feed displays newly uploaded images, fostering community engagement.

## Installation

To set up Everafter locally, follow these steps:

1. **Clone the Repository**:

   ```bash
   git clone https://github.com/pixelpump/everafter.git
Navigate to the Project Directory:

bash

cd everafter
Install Dependencies:

Ensure you have Node.js installed. Then, install the required packages:

bash

npm install
Set Up Environment Variables:

Create a .env file in the root directory and configure the necessary environment variables as per your setup.

Start the Application:

For a standard HTTP server:

bash

node server.js
For an HTTPS server (ensure you have the necessary SSL certificates):

bash

node sslhttpserver.js
Access the Application:

Open your web browser and navigate to http://localhost:3000 (or the appropriate port if different).

Usage
Once the application is running:

Uploading Images: Use the upload interface to add images to the gallery.

Viewing the Live Feed: Access the live feed to see the latest uploaded images in real-time.

Planned Features
The development roadmap for Everafter includes the following enhancements:

Vibration Feedback: Implement vibration alerts upon new image uploads.

Slideshow Control: Provide an option to disable the slideshow feature entirely.

Image Moderation: Develop a system where images are queued until approved, ensuring content quality.

Google OAuth Integration: Consider integrating Google OAuth for user authentication.

Owner Gallery: Create a dedicated gallery for the owner, possibly inspired by designs like this one.

Image CDN: Utilize a Content Delivery Network to store images, serve optimized versions, and enable full-resolution downloads in a zip format.

Upload Button Animation: Enhance the upload button with animations, similar to this example.

Live Feed Moderation: Implement moderation for uploads appearing in the live feed.

User Comments: Allow users to add comments to uploaded images.

Background Color Customization: Enable the owner to change the live feed's background color, possibly using designs like this one.

Video Uploads: Explore the possibility of supporting video uploads, catering to guests who cannot attend events.

Contributing
Contributions to Everafter are welcome. To contribute:

Fork the Repository: Click the "Fork" button at the top right of the repository page.

Clone Your Fork:

bash

git clone https://github.com/your-username/everafter.git
Create a New Branch:

bash

git checkout -b feature/your-feature-name
Make Your Changes: Implement your feature or fix.

Commit Your Changes:

bash

git commit -m "Add your descriptive commit message"
Push to Your Fork:

bash

git push origin feature/your-feature-name
Submit a Pull Request: Navigate to the original repository and click "New Pull Request."

License
Everafter is licensed under the MIT License.
