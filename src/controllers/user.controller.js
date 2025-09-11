import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken";

const generateAccessAndRefreshTokens = async (userId) => {
  try {
    const user = await User.findById(userId);
    const accessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();

    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });

    return { accessToken, refreshToken };
  } catch (error) {
    throw new ApiError(500, "Error generating access and refresh tokens.");
  }
};

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

const loginUser = asyncHandler(async (req, res) => {
  //req body -> data
  // access using username or email
  // find the user
  // check password
  // generate accessToken and refreshToken
  // send response and coolkie

  const { email, username, password } = req.body;

  // if(!(username || email)){
  //   throw new ApiError(400, "Email or username is required.");
  // }

  if (!username && !email) {
    throw new ApiError(400, "Email or username is required.");
  }

  const user = await User.findOne({
    $or: [{ email }, { username }],
  });

  if (!user) {
    throw new ApiError(404, "User does not exist.");
  }

  const isPasswordValid = await user.isPasswordCorrect(password);

  if (!isPasswordValid) {
    throw new ApiError(401, "Invalid user credentials.");
  }
  const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(
    user._id
  );

  const loggedInUser = await User.findById(user._id).select(
    // fields to be removed from response.
    " -password -refreshToken"
  );

  const options = {
    httpOnly: true,
    secure: true,
    // maxAge: 24 * 60 * 60 * 1000,
  };

  return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
      new ApiResponse(
        200,
        {
          user: loggedInUser,
          accessToken,
          refreshToken,
        },
        "User Logged In Successfully."
      )
    );
});

const logoutUser = asyncHandler(async (req, res) => {
  await User.findByIdAndUpdate(
    req.user._id,
    {
      refreshToken: undefined,
    },
    {
      new: true,
    }
  );
  const options = {
    httpOnly: true,
    secure: true,
  };
  return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new ApiResponse(200, null, "User Logged Out Successfully."));
});

const refreshAccessToken = asyncHandler(async (req, res) => {
  const incomingRefreshToken =
    req.cookies.refreshToken || req.body.refreshToken;

  if (!incomingRefreshToken) {
    throw new ApiError(401, "Unauthorized request.");
  }

  try {
    const decodedToken = jwt.verify(
      incomingRefreshToken,
      process.env.REFRESH_TOKEN_SECRET
    );

    const user = await User.findById(decodedToken?._id);

    if (!user) {
      throw new ApiError(401, "Invalid Refresh Token.");
    }

    if (user?.refreshToken !== incomingRefreshToken) {
      throw new ApiError(401, "Refresh Token Expired.");
    }

    const options = {
      httpOnly: true,
      secure: true,
    };

    const { accessToken, newRefreshToken } =
      await generateAccessAndRefreshTokens(user._id);

    return res
      .status(200)
      .cookie("accessToken", user.accessToken, options)
      .cookie("refreshToken", user.newRefreshToken, options)
      .json(
        new ApiResponse(
          200,
          {
            accessToken,
            refreshToken: newRefreshToken,
          },
          "Access Token Refreshed Successfully."
        )
      );
  } catch (error) {
    throw new ApiError(401, error?.message || "Invalid Refresh Token.");
  }
});

const changeCurrentPassword = asyncHandler(async (req, res) => {
  const { oldPassword, newPassword } = req.body;

  const user = await User.findById(req.user?._id);

  const isPasswordCorrect = await user.isPasswordCorrect(oldPassword);

  if (!isPasswordCorrect) {
    throw new ApiError(400, "Old Password is incorrect.");
  }

  user.password = newPassword;
  await user.save({ validateBeforeSave: false });

  return res
    .status(200)
    .json(new ApiResponse(200, {}, "Password Changed Successfully."));
});

const getCurrentUser = asyncHandler(async (req, res) => {
  return res
    .ststus(200)
    .json(new ApiResponse(200, req.user, "Current user fetched successfully."));
});

const updateAccountDetails = asyncHandler(async (req, res) => {
  const { fullName, email } = req.body;
  // if you are updating files , then make seperate controller and endpoints.

  if (!fullName || !email) {
    throw new ApiError(400, "All fields are required.");
  }

  const user = User.findOneAndUpdate(
    req.user?._id,
    {
      $set: {
        fullName,
        email,
      },
    },
    { new: true }
  ).select("-password");

  return res
    .status(200)
    .json(new ApiResponse(200, user, "Account details Updated Successfully."));
});

const updateUserAvatar = asyncHandler(async (req, res) => {
  const avatarLocalPath = req.file?.path;
  if (!avatarLocalPath) {
    throw new ApiError(400, "Avatar  file is missing.");
  }

  const avatar = await uploadOnCloudinary(avatarLocalPath);

  if (!avatar.url) {
    throw new ApiError(400, "Error while uploading avatar.");
  }

  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        avatar: avatar.url,
      },
    },
    { new: true }
  ).selsct("-password");

  return res
    .status(200)
    .json(new ApiResponse(200, user, "Avatar Updated Successfully."));
});

const updateUserCoverImage = asyncHandler(async (req, res) => {
  const coverImageLocalPath = req.file?.path;
  if (!coverImageLocalPath) {
    throw new ApiError(400, "Cover Image  file is missing.");
  }

  const coverImage = await uploadOnCloudinary(coverImageLocalPath);

  if (!coverImage.url) {
    throw new ApiError(400, "Error while uploading Cover Image.");
  }

  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        coverImage: coverImage.url,
      },
    },
    { new: true }
  ).selsct("-password");

  return res
    .status(200)
    .json(new ApiResponse(200, user, "Cover Image Updated Successfully."));
});

export {
  registerUser,
  loginUser,
  logoutUser,
  refreshAccessToken,
  changeCurrentPassword,
  getCurrentUser,
  updateAccountDetails,
  updateUserAvatar,
  updateUserCoverImage,
};
