import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";

const registerUser = asyncHandler(async (req, res) => {
  // get user details from frontend. [if from form, json then req.body || if from url ??]
  // check for validation errors. if any fields are missing or invalid.
  // Chcek if user already exists in the database. usingh email & username
  // if user exists, throw error
  //check for images , avatar
  // upload on cloudinary
  // create user object -- create entry in database
  // remove password, refresh token field from response.
  // check user creation status.
  // return/send response.

  const { username, email, fullName, password } = req.body;
  console.log("Email: ", email, "Password: ", password);

  if (
    [fullName, username, email, password].some((field) => field?.trim() === "")
  ) {
    throw new ApiError(400, "All fields are required.");
  }
  // validation for email
  // validation for password
  // can makeseperate file for validation
});

export { registerUser };
