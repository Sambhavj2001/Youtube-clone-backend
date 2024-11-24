import {asyncHandler} from '../utils/asynchandler.js'
import {ApiErrors} from '../utils/ApiErrors.js'
import {ApiResponse} from '../utils/ApiResponse.js'
import {User} from '../models/user.model.js'
import {uploadOnCloudinary} from '../utils/cloudinary.js'
import jwt from "jsonwebtoken"

const generateAccessAndRefreshTokens = async(userId)=>{
    try {
        const user = await User.findById(userId);
        const accessToken = await user.generateAccessToken()
        const refreshToken = await user.generateRefreshToken()

        user.refreshToken = refreshToken;
        await user.save({validateBeforeSave: false});

        return {accessToken, refreshToken};
    } catch (error) {
        throw new ApiErrors(500,`Something went wrong while generating access and refresh tokens`)
    }
}
const registerUser = asyncHandler(async (req,res)=>{
    //get user details from frontend
    const {username, email, fullName, password} = req.body
    console.log(email);
    
    //validations - like empty
    if(
        [username,email,fullName,password].some((field)=> field?.trim() === "")
    ){
        throw new ApiErrors(400,"All fields are required")
    }

    //check if user is already exists or not
    const existedUser = await User.findOne({
        $or: [{username},{email}]
    })
    if(existedUser){
        throw new ApiErrors(409,"User with email or username already exists")
        
    }

    //check images and avatar is required
    console.log(req.files);
    const avatarLocalPath = req.files?.avatar[0]?.path;
    // const coverImageLocalPath = req.files?.coverImage[0]?.path;

    let coverImageLocalPath;
    if(req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0){
        coverImageLocalPath = req.files.coverImage[0].path
    }
    if(!avatarLocalPath){
        throw new ApiErrors(400, "Avatar file is required")
    }
    
    //upload images on clodinary
    const avatar = await uploadOnCloudinary(avatarLocalPath)
    const coverImage = await uploadOnCloudinary(coverImageLocalPath)

    if(!avatar){
        throw new ApiErrors(400, "Avatar file is required")
    }

    //create object 
    const user = await User.create({
        username: username.toLowerCase(),
        email,
        fullName,
        password,
        avatar: avatar.url,
        coverImage: coverImage?.url || ""
    })

    //remove password and refresh token from res
    const createdUser = await User.findById(user._id).select(
        "-password -refreshToken"
    )

    //check user created or not
    if(!createdUser){
        throw new ApiErrors(500, "Something went wrong while registering the user");   
    }
    //return res
    return res.status(201).json(
        new ApiResponse(200, createdUser, "User registered Successfully")
    )
})

const loginUser = asyncHandler(async (req,res)=>{   
    //req.body  -> data
    const {username, email, password} = req.body

    //username or email
    if(!(username || email)){
        throw new ApiErrors(400,`username or email is required`);
    }

    //find the user
    const user = await User.findOne({
        $or: [{username},{email}]
    });
    if(!user){
        throw new ApiErrors(404,"User does not exist");
        
    }

    //check password
    const isPasswordValid = await user.isPasswordCorrect(password)
    if(!isPasswordValid){
        throw new ApiErrors(401,"Invalid User's Password");
        
    }
    //access and refresh token
    const {accessToken,refreshToken} = await generateAccessAndRefreshTokens(user._id)

    //send cookies
    const loggedInUser = await User.findById(user._id).select("-password -refreshToken")

    const options = {
        httpOnly: true,
        secure: true
    }
    return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
        new ApiResponse(
            200,
            {
                user: loggedInUser, accessToken, refreshToken
            },
            "User logged in successfully"
        )
    )
})

const logoutUser = asyncHandler (async (req,res)=>{
    await User.findByIdAndUpdate(
        req.user._id,
        {
            $set:{
                refreshToken: undefined
            }
        },
        {
            new: true
        }
    )

    const options = {
        httpOnly: true,
        secure: true
    }

    return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new ApiResponse(200, {}, "User logged Out"))

})

const refreshAccessToken = asyncHandler(async (req,res)=>{
    const incomingRefreshToken = req.cookies.refreshToken || req.header.refreshToken

    if(!incomingRefreshToken){
        throw new ApiErrors(401,"UnAuthorized Request");
    }

    try {
        const decodedToken = jwt.verify(incomingRefreshToken, process.env.REFRESH_TOKEN_SECRET)
    
        const user = await User.findById(decodedToken._id)
    
        if(!user){
            throw new ApiErrors(401, "Invalid Refresh Token")
        }
    
        if(incomingRefreshToken !== user.refreshToken){
            throw new ApiErrors(401, "Refresh token is expired or used")
        }
    
        const {accessToken, newRefreshToken} = await generateAccessAndRefreshTokens(user._id)
    
        const options = {
            httpOnly:true,
            secure: true
        }
    
        return res
        .status(200)
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken", newRefreshToken, options)
        .json(
            new ApiResponse(200,
                {accessToken, "refreshToken": newRefreshToken},
                "Access Token Refreshed"
            )
        )
    } catch (error) {
        throw new ApiErrors(401, error.message || "Invalid refresh token")
    }
})
export { registerUser, loginUser, logoutUser, refreshAccessToken}