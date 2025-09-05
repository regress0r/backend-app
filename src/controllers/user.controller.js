import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";

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
  // console.log(req.body);
  // console.log("Email: ", email, "Password: ", password);

  // To check if any field is missing or empty.
  if (
    [fullName, username, email, password].some((field) => field?.trim() === "")
  ) {
    throw new ApiError(400, "All fields are required.");
  }
  //CAN DO NEXT: v-14 24
  // validation for email
  // validation for password
  // can makeseperate file for validation.

  // check if user already exists.
  const existedUser = await User.findOne({
    $or: [{ email }, { username }],
  });

  if (existedUser) {
    throw new ApiError(409, "User already exists with this email or username.");
  }

  // console.log(req.files?)

  const avatarLocalPath = req.files?.avatar?.[0]?.path;

  const coverImageLocalPath = req.files?.coverImage?.[0]?.path;

  // let coverImageLocalPath;
  // if (req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0) {
  //   coverImageLocalPath = req.files.coverImage[0].path;
  // }
  // console.log(req.files);
  // console.table(req.files);

  if (!avatarLocalPath) {
    throw new ApiError(400, "Avatar is required.");
  }

  // uploading on cloudinary from method uploadOnCloudinary
  const avatar = await uploadOnCloudinary(avatarLocalPath);
  const coverImage = await uploadOnCloudinary(coverImageLocalPath);

  // check again if avatar is uploaded or not.
  if (!avatar) {
    throw new ApiError(400, "Avatar could not be uploaded on cloudinary.");
  }

  // create user object and database entry.
  const user = await User.create({
    fullName,
    avatar: avatar.url, // url of cloudinary
    coverImage: coverImage?.url || "", // haven't check if coverImage is uploaded successfully or not. so optional chaining is used, so that if coverImage is not uploaded, then it will not throw error.
    password,
    email,
    username: username.toLowerCase(),
  });
  // console.log(user);

  // check user creation status.
  const createdUser = await User.findById(user._id).select(
    // fields to be removed from response.
    " -password -refreshToken"
  );

  if (!createdUser) {
    throw new ApiError(500, "Something went wrong while registering user.");
  }

  return res
    .status(201)
    .json(new ApiResponse(200, createdUser, "User Registered Successfully."));
});

export { registerUser };
