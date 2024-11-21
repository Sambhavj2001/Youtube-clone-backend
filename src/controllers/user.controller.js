import {asyncHandler} from '../utils/asynchandler.js'
import {ApiErrors} from '../utils/ApiErrors.js'
import {ApiResponse} from '../utils/ApiResponse.js'
import {User} from '../models/user.model.js'
import {uploadOnCloudinary} from '../utils/cloudinary.js'

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
    const existedUser = User.findOne({
        $or: [{username},{email}]
    })
    if(existedUser){
        throw new ApiErrors(409,"User with email or username already exists")
        
    }
    //check images and avatar is required
    console.log(req.files);
    const avatarLocalPath = req.files?.avatar[0]?.path;
    const coverImageLocalPath = req.files?.coverImage[0]?.path;
    
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

export { registerUser }