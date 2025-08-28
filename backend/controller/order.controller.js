import Order from "../models/order.model.js";
import Product from "../models/product.model.js";
import Stripe from"stripe";
// Place order COD: /api/order/place
export const placeOrderCOD = async (req, res) => {
  try {
    const userId = req.user;
    const { items, address } = req.body;
    if (!address || !items || items.length === 0) {
      return res
        .status(400)
        .json({ message: "Invalid order details", success: false });
    }
    // calculate amount using items;
    let amount = await items.reduce(async (acc, item) => {
      const product = await Product.findById(item.product);
      return (await acc) + product.offerPrice * item.quantity;
    }, 0);

    // Add tex charfe 2%
    amount += Math.floor((amount * 2) / 100);
    await Order.create({
      userId,
      items,
      address,
      amount,
      paymentType: "COD",
      isPaid: false,
    });
    res
      .status(201)
      .json({ message: "Order placed successfully", success: true });
  } catch (error) {
    res.status(500).json({ message: "Internal Server Error" });
  }
};

// Place order stripe: /api/order/place
export const placeOrderStripe = async (req, res) => {
  try {
    const userId = req.user;
    const { items, address } = req.body;
    const {origin}=req.headers;
    if (!address || !items || items.length === 0) {
      return res
        .status(400)
        .json({ message: "Invalid order details", success: false });
    }
    // calculate amount using items;
    let productData=[];
    let amount = await items.reduce(async (acc, item) => {
      const product = await Product.findById(item.product);
      productData.push({
        name:product.name,
        price:product.offerPrice,
        quantity:item.quantity
      })
      return (await acc) + product.offerPrice * item.quantity;
    }, 0);

    // Add tex charfe 2%
    amount += Math.floor((amount * 2) / 100);
    const order=await Order.create({
      userId,
      items,
      address,
      amount,
      paymentType: "Online",
      isPaid: true,
    });
    //stripe gateway
    const stripeInstance=new Stripe(process.env.STRIPE_SECRET_KEY);
    //stripe lines
    const line_items=productData.map((item)=>{
      return{
        price_data:{
          currency:"USD",
          product_data:{
            name:item.name
          },unit_amount: Math.round(item.price * 100) // Stripe expects amount in paise/cents

        },
        quantity:item.quantity,
      };
    });
    //create session
    const session=await stripeInstance.checkout.sessions.create({
      line_items,
      mode:"payment",
      success_url:`${origin}/loader?next=my-order`,
      cancel_url:`${origin}/cart`,
      metadata:{
        orderId:order._id.toString(),
        userId,
      }
    });
    res
      .status(201)
      .json({ message: "Order placed successfully", success: true, url:session.url, });
  } catch (error) {
res.status(500).json({ message: error.message });

  }
};

// oredr details for individual user :/api/order/user
export const getUserOrders = async (req, res) => {
  try {
    const userId = req.user;
    const orders = await Order.find({
      userId,
      $or: [{ paymentType: "COD" }, { isPaid: true }],
    })
      .populate("items.product address")
      .sort({ createdAt: -1 });
    res.status(200).json({ success: true, orders });
  } catch (error) {
    res.status(500).json({ message: "Internal Server Error" });
  }
};

// get all orders for admin :/api/order/all
export const getAllOrders = async (req, res) => {
  try {
    const orders = await Order.find({
      $or: [{ paymentType: "COD" }, { isPaid: true }],
    })
      .populate("items.product address")
      .sort({ createdAt: -1 });
    res.status(200).json({ success: true, orders });
  } catch (error) {
    res.status(500).json({ message: "Internal Server Error" });
  }
};